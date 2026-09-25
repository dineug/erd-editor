import {
  GOOGLE_REVOKE_URL,
  hasDriveFileScope,
  SCOPES,
} from '@/server/auth/google';
import {
  isLogoutPending,
  recordLogoutPending,
  recordServerUnavailable,
  RELAY_TIMEOUT_MS,
  type RelayToken,
  type RelayTokenResult,
  requestRelayLogout,
  requestRelayToken,
  shouldTryServer,
  withTimeout,
} from '@/services/gdrive/authMode';
import type {
  GisError,
  GisOAuth2,
  GisTokenClient,
  GisTokenRequest,
  GisTokenResponse,
} from '@/services/gdrive/gis';
import {
  type OAuthPopup,
  type OAuthPopupDeps,
  type OAuthPopupOutcome,
  openOAuthPopup,
} from '@/services/gdrive/oauthPopup';
import type {
  ChannelLike,
  CreateChannel,
  FetchLike,
  LockManagerLike,
  StorageLike,
} from '@/services/gdrive/types';
import { safeCallback } from '@/utils/safeCallback';

export const TOKEN_CHANNEL = '@dineug/erd-editor-app/gdrive-token';
export const REFRESH_LOCK = '@dineug/erd-editor-app/gdrive-token-refresh';
export const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
/** Marks Sign in, Reconnect Google, Sign out and their kin: a click on one renews nothing by itself. */
export const AUTH_CONTROL_ATTRIBUTE = 'data-gdrive-auth-control';

/** How long before expiry a token is renewed. */
export const REFRESH_MARGIN_MS = 5 * 60_000;
/** The shortest wait before renewing, so a short-lived token cannot spin. */
export const MIN_RENEW_DELAY_MS = 5_000;
/** How long a tab waits for another tab to hand it a token before asking the relay. */
export const ADOPT_WAIT_MS = 200;
export const RETRY_REFRESH_MS = 30_000;
/** A token this close to expiry is not handed to a Drive call. */
const EXPIRY_SKEW_MS = 10_000;

/**
 * Where this tab stands. server and fallback hold a token, from the relay or
 * from the GIS token client; fallback-expired needs Reconnect Google; offline
 * waits to decide, since no answer can be read as an unavailable relay.
 */
export type TokenStatus =
  | 'unknown'
  | 'offline'
  | 'signed-out'
  | 'server'
  | 'fallback'
  | 'fallback-expired'
  | 'account-changed'
  | 'scope-missing';

/** Which sign-in the tab offers: the relay's popup, or GIS after the relay failed its contract. */
export type RelayMode = 'server' | 'fallback';

export type GoogleAccount = { sub: string; email: string };

export type SignInResult = OAuthPopupOutcome['kind'];

export type TokenSnapshot = {
  status: TokenStatus;
  mode: RelayMode;
  account: GoogleAccount | null;
  expiresAt: number | null;
  /** In the fallback near or past expiry: the next click outside a text field renews. */
  renewDue: boolean;
  signingIn: boolean;
  gis: 'idle' | 'loading' | 'ready' | 'blocked';
  /** The last sign-in's failure, for the screen that offered it. */
  error: 'popup-blocked' | 'failed' | null;
  /** Signed out by a person's Sign out, in this tab or another, rather than by the relay's 401. */
  bySignOut: boolean;
};

/** No token to give: the status says what the person has to do. */
export class TokenUnavailableError extends Error {
  name = 'TokenUnavailableError';
  readonly status: TokenStatus;

  constructor(status: TokenStatus) {
    super(`No Google access token: ${status}`);
    this.status = status;
  }
}

export type TokenManagerDeps = {
  /** Called without a receiver; bind it where the manager is assembled. */
  fetch: FetchLike;
  clientId: string;
  createChannel: CreateChannel;
  locks: LockManagerLike | null;
  storage: StorageLike | null;
  loadGis: () => Promise<GisOAuth2>;
  openWindow: OAuthPopupDeps['open'];
  /** The window: capture clicks and keyups, and online. */
  events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  document: Pick<Document, 'visibilityState'> &
    Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  isOnline?: () => boolean;
  now?: () => number;
};

/** A token as the tabs share it; the access token never leaves memory and the channel. */
type Session = {
  accessToken: string;
  /** When it was asked for, so a tab that signed out since drops it. */
  issuedAt: number;
  expiresAt: number;
  renewAt: number;
  scope: string | null;
  account: GoogleAccount;
  mode: RelayMode;
};

/**
 * fromSignOut tells a person's sign-out, which also ends the sign-ins still
 * open in every tab, from the relay's 401.
 */
type TokenMessage =
  | { type: 'request' }
  | { type: 'token'; session: Session }
  | { type: 'signed-out'; at: number | null; fromSignOut: boolean };

/** When a token was asked for, and the sign-outs and sign-ins this tab had seen by then. */
type Asked = { at: number; signOuts: number; signIns: number };

type GisAttempt = { intentional: boolean; asked: Asked };

type GisResult =
  | { kind: 'response'; response: GisTokenResponse }
  | { kind: 'error'; error: GisError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSession(value: unknown): Session | null {
  if (!isRecord(value) || !isRecord(value.account)) return null;
  const { accessToken, issuedAt, expiresAt, renewAt, scope, account, mode } =
    value;
  const { sub, email } = account;
  if (
    typeof accessToken !== 'string' ||
    typeof issuedAt !== 'number' ||
    typeof expiresAt !== 'number' ||
    typeof renewAt !== 'number' ||
    (typeof scope !== 'string' && scope !== null) ||
    typeof sub !== 'string' ||
    typeof email !== 'string' ||
    (mode !== 'server' && mode !== 'fallback')
  ) {
    return null;
  }
  return {
    accessToken,
    issuedAt,
    expiresAt,
    renewAt,
    scope,
    account: { sub, email },
    mode,
  };
}

function readTokenMessage(data: unknown): TokenMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === 'request') return { type: 'request' };
  if (data.type === 'signed-out') {
    return {
      type: 'signed-out',
      at: typeof data.at === 'number' ? data.at : null,
      fromSignOut: data.fromSignOut === true,
    };
  }
  const session = data.type === 'token' ? readSession(data.session) : null;
  return session && { type: 'token', session };
}

/**
 * A grant that says what it covers and leaves drive.file out. An empty or
 * missing scope says nothing; Drive's own 403 still catches that case.
 */
export function lacksDriveScope(scope: string | null): boolean {
  return !!scope && !hasDriveFileScope(scope);
}

function isEditingTarget(target: EventTarget): boolean {
  const element = target as Partial<HTMLElement>;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    // Its shadow root is closed: a listener outside sees the host and nothing
    // inside it, so any gesture in the editor may be typing into a field.
    tag === 'ERD-EDITOR' ||
    element.isContentEditable === true
  );
}

/** Whether a gesture lands where a popup taking focus would swallow keystrokes. */
export function isEditingGesture(event: Event): boolean {
  return event.composedPath().some(isEditingTarget);
}

function isAuthControl(target: EventTarget): boolean {
  return (
    (target as Partial<Element>).hasAttribute?.(AUTH_CONTROL_ATTRIBUTE) === true
  );
}

/** A click on a sign-in or sign-out control, whose own handler decides. */
export function isAuthControlGesture(event: Event): boolean {
  return event.composedPath().some(isAuthControl);
}

/** The account of a token; ten seconds of silence fail like any other error. */
export async function fetchUserInfo(
  send: FetchLike,
  accessToken: string,
  timeoutMs = RELAY_TIMEOUT_MS
): Promise<GoogleAccount> {
  const body = await withTimeout(timeoutMs, async signal => {
    const response = await send(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    return response.ok ? ((await response.json()) as unknown) : null;
  });
  if (
    !isRecord(body) ||
    typeof body.sub !== 'string' ||
    typeof body.email !== 'string'
  ) {
    throw new Error('Google userinfo failed');
  }
  return { sub: body.sub, email: body.email };
}

/**
 * Revokes the grant behind an access token at Google, the refresh token
 * included. A form POST, so no preflight; its answer changes nothing.
 */
export async function revokeAtGoogle(
  send: FetchLike,
  accessToken: string
): Promise<void> {
  try {
    await withTimeout(RELAY_TIMEOUT_MS, signal =>
      send(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken }).toString(),
        signal,
      })
    );
  } catch {
    // The logout left pending still clears the cookie before its next use.
  }
}

/** What a Reconnect Google through the relay reports when it ends without a token. */
const RECONNECT_RESULTS: Partial<Record<TokenStatus, SignInResult>> = {
  'signed-out': 'cancelled',
  'fallback-expired': 'unavailable',
  'scope-missing': 'scope-missing',
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * The access token of /gdrive, in memory and shared by this browser's tabs,
 * which ask the relay under a lock, so once between them. A relay failing its
 * contract sends them to GIS until UTC midnight, its cookie left alone.
 */
export function createTokenManager(deps: TokenManagerDeps) {
  const {
    fetch: send,
    clientId,
    createChannel,
    locks,
    storage,
    loadGis,
    openWindow,
    events,
    document: doc,
    isOnline = () => globalThis.navigator?.onLine !== false,
    now = Date.now,
  } = deps;

  const listeners = new Set<() => void>();
  let snapshot: TokenSnapshot = {
    status: 'unknown',
    mode: 'server',
    account: null,
    expiresAt: null,
    renewDue: false,
    signingIn: false,
    gis: 'idle',
    error: null,
    bySignOut: false,
  };
  let session: Session | null = null;
  let channel: ChannelLike | null = null;
  let started: Promise<void> | null = null;
  let refreshing: Promise<void> | null = null;
  let pendingSignIn: Promise<SignInResult> | null = null;
  let popup: OAuthPopup | null = null;
  let oauth2: GisOAuth2 | null = null;
  let tokenClient: GisTokenClient | null = null;
  let gisPending: ((result: GisResult) => void) | null = null;
  /** The open token client request, and whether someone asked for it. */
  let gisAttempt: GisAttempt | null = null;
  let gestureBlocked = false;
  /** Counts the sign-outs this tab saw, so an answer asked for before one is dropped. */
  let signOutEpoch = 0;
  /** Counts the sign-ins this tab finished, so a renewal asked for before one is dropped. */
  let signInEpoch = 0;
  /** Relay logouts run one after another, so the last one sent sets the pending flag last. */
  let loggingOut: Promise<boolean> = Promise.resolve(true);
  /** The latest sign-out of any tab, so a token issued before it is not adopted. */
  let signedOutAt = -Infinity;
  let renewTimer: ReturnType<typeof setTimeout> | undefined;
  let expireTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const update = (patch: Partial<TokenSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => safeCallback(listener));
  };
  const post = (message: TokenMessage) => channel?.postMessage(message);

  const clearTimers = () => {
    clearTimeout(renewTimer);
    clearTimeout(expireTimer);
    clearTimeout(retryTimer);
  };

  const isFresh = (candidate: Session | null, stale: string | null) =>
    !!candidate && candidate.accessToken !== stale && now() < candidate.renewAt;

  /** Read afresh after every await: another tab's token can stop this one meanwhile. */
  const isAccountChanged = () => snapshot.status === 'account-changed';

  const askedNow = (): Asked => ({
    at: now(),
    signOuts: signOutEpoch,
    signIns: signInEpoch,
  });
  const isOutdated = (asked: Asked) =>
    asked.signOuts !== signOutEpoch || asked.signIns !== signInEpoch;

  const schedule = () => {
    clearTimers();
    if (!session || disposed) return;
    renewTimer = setTimeout(onRenewDue, Math.max(0, session.renewAt - now()));
    expireTimer = setTimeout(onExpired, Math.max(0, session.expiresAt - now()));
  };

  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    if (disposed) return;
    retryTimer = setTimeout(() => {
      if (session) void refresh(session.accessToken);
    }, RETRY_REFRESH_MS);
  };

  const setSession = (next: Session, broadcast: boolean) => {
    session = next;
    gestureBlocked = false;
    update({
      status: next.mode,
      mode: next.mode,
      account: next.account,
      expiresAt: next.expiresAt,
      renewDue: false,
      error: null,
      bySignOut: false,
    });
    if (next.mode === 'fallback') ensureGis();
    schedule();
    if (broadcast) post({ type: 'token', session: next });
  };

  const clearSession = (
    status: TokenStatus,
    mode = snapshot.mode,
    bySignOut = false
  ) => {
    session = null;
    clearTimers();
    update({
      status,
      mode,
      account: status === 'signed-out' ? null : snapshot.account,
      expiresAt: null,
      renewDue: status === 'fallback-expired',
      bySignOut,
    });
  };

  function ensureGis() {
    if (snapshot.gis === 'loading' || snapshot.gis === 'ready') return;
    update({ gis: 'loading' });
    loadGis().then(
      loaded => {
        oauth2 = loaded;
        tokenClient = loaded.initTokenClient({
          client_id: clientId,
          scope: SCOPES.join(' '),
          callback: response => settleGis({ kind: 'response', response }),
          error_callback: error => settleGis({ kind: 'error', error }),
        });
        update({ gis: 'ready' });
      },
      () => update({ gis: 'blocked' })
    );
  }

  function settleGis(result: GisResult) {
    const resolve = gisPending;
    gisPending = null;
    resolve?.(result);
  }

  /** The relay failed its contract: keep a live token to its end, then GIS. */
  function fallBack() {
    ensureGis();
    if (session && now() < session.expiresAt) {
      session = { ...session, mode: 'fallback' };
      update({
        status: 'fallback',
        mode: 'fallback',
        renewDue: now() >= session.renewAt,
      });
      schedule();
    } else {
      clearSession(
        snapshot.account ? 'fallback-expired' : 'signed-out',
        'fallback'
      );
    }
  }

  function expireFallback() {
    clearSession('fallback-expired', 'fallback');
  }

  function onRenewDue() {
    if (session?.mode === 'server') void refresh(session.accessToken);
    else if (session) update({ renewDue: true });
  }

  function onExpired() {
    if (session?.mode !== 'fallback') return;
    // Past the recorded midnight the relay gets its turn again.
    if (shouldTryServer(storage, now())) void refresh(session.accessToken);
    else expireFallback();
  }

  function markSignedOut(at: number) {
    signOutEpoch++;
    signedOutAt = Math.max(signedOutAt, at);
  }

  /**
   * A token this tab obtained: its account read from userinfo, then shared. A
   * sign-out, or a sign-in of this tab, since it was asked for drops it.
   */
  async function acceptOwnToken(
    token: RelayToken,
    mode: RelayMode,
    intentional: boolean,
    asked = askedNow()
  ): Promise<SignInResult> {
    const outdated = () => isOutdated(asked);
    if (lacksDriveScope(token.scope)) {
      clearSession('scope-missing', mode);
      return 'scope-missing';
    }
    let account: GoogleAccount;
    try {
      account = await fetchUserInfo(send, token.accessToken);
    } catch {
      if (outdated()) return 'cancelled';
      if (session) scheduleRetry();
      else update({ status: 'signed-out', mode, error: 'failed' });
      return 'error';
    }
    if (outdated()) return 'cancelled';
    if (
      !intentional &&
      snapshot.account &&
      snapshot.account.sub !== account.sub
    ) {
      clearSession('account-changed');
      return 'error';
    }
    if (intentional) signInEpoch++;
    const issuedAt = asked.at;
    const expiresAt = issuedAt + token.expiresIn * 1000;
    setSession(
      {
        accessToken: token.accessToken,
        issuedAt,
        expiresAt,
        renewAt: Math.max(
          expiresAt - REFRESH_MARGIN_MS,
          issuedAt + MIN_RENEW_DELAY_MS
        ),
        scope: token.scope,
        account,
        mode,
      },
      true
    );
    return 'done';
  }

  async function applyRelayResult(result: RelayTokenResult, asked: Asked) {
    const hadSession = !!session;
    switch (result.kind) {
      case 'token':
        await acceptOwnToken(result.token, 'server', false, asked);
        return;
      case 'signed-out':
        clearSession('signed-out', 'server');
        // The cookie is gone for every tab, not only this one.
        if (hadSession) {
          post({ type: 'signed-out', at: now(), fromSignOut: false });
        }
        return;
      case 'unavailable':
        recordServerUnavailable(storage, now());
        fallBack();
        return;
      default:
        if (hadSession) scheduleRetry();
        else update({ status: 'offline' });
    }
  }

  /** Waits a moment for another tab's token; true once one fresher than stale arrived. */
  async function adoptFromTabs(stale: string | null): Promise<boolean> {
    post({ type: 'request' });
    await delay(ADOPT_WAIT_MS);
    return isFresh(session, stale);
  }

  const withLock = (run: () => Promise<void>) =>
    locks ? locks.request(REFRESH_LOCK, run) : run();

  /**
   * Every token request of this tab. A logout a sign-out left pending goes
   * first, and until the relay confirms it the cookie it clears is not used.
   */
  async function relayToken(): Promise<RelayTokenResult> {
    if (isLogoutPending(storage)) {
      if (!(await requestRelayLogout({ fetch: send }))) {
        return isOnline() ? { kind: 'unavailable' } : { kind: 'offline' };
      }
      recordLogoutPending(storage, false);
    }
    return requestRelayToken({ fetch: send, isOnline });
  }

  /**
   * Renews the token stale names, or finds the first one when stale is null.
   * Under the lock a tab first takes what another tab just renewed, so the
   * tabs of a browser call the relay once between them.
   */
  function refresh(stale: string | null): Promise<void> {
    refreshing ??= withLock(async () => {
      if (disposed || isAccountChanged() || isFresh(session, stale)) return;
      if ((await adoptFromTabs(stale)) || disposed || isAccountChanged()) {
        return;
      }
      if (!shouldTryServer(storage, now())) return fallBack();
      const asked = askedNow();
      const result = await relayToken();
      // A sign-out, or this tab's sign-in, while the relay answered wins.
      if (!isOutdated(asked)) await applyRelayResult(result, asked);
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  function adopt(incoming: Session) {
    if (
      snapshot.status === 'account-changed' ||
      incoming.issuedAt < signedOutAt ||
      now() >= incoming.expiresAt ||
      (session && incoming.expiresAt <= session.expiresAt) ||
      lacksDriveScope(incoming.scope)
    ) {
      return;
    }
    if (snapshot.account && snapshot.account.sub !== incoming.account.sub) {
      clearSession('account-changed');
      return;
    }
    setSession(incoming, false);
  }

  function onMessage(event: MessageEvent) {
    const message = readTokenMessage(event.data);
    if (message?.type === 'request') {
      if (session && now() < session.expiresAt) {
        post({ type: 'token', session });
      }
    } else if (message?.type === 'token') {
      adopt(message.session);
    } else if (message?.type === 'signed-out') {
      markSignedOut(message.at ?? now());
      if (message.fromSignOut) endSignIns();
      if (session || snapshot.account) {
        clearSession('signed-out', snapshot.mode, message.fromSignOut);
      } else if (message.fromSignOut && snapshot.status === 'signed-out') {
        update({ bySignOut: true });
      }
    }
  }

  function onGesture(event: Event) {
    const account = snapshot.account;
    if (
      !snapshot.renewDue ||
      snapshot.mode !== 'fallback' ||
      gestureBlocked ||
      gisPending ||
      !account ||
      isEditingGesture(event) ||
      isAuthControlGesture(event)
    ) {
      return;
    }
    // Past the recorded midnight an expired tab asks the relay first.
    if (!session && shouldTryServer(storage, now())) {
      void refresh(null);
      return;
    }
    void requestGisToken({ prompt: '', login_hint: account.sub }, false);
  }

  /**
   * Another tab may have found the relay unavailable, or midnight passed: a
   * tab without a token follows the flag they share once it shows again.
   */
  function followRelayFlag() {
    if (session) return;
    const tryServer = shouldTryServer(storage, now());
    const { status, mode } = snapshot;
    if (!tryServer && mode === 'server' && status === 'signed-out') {
      fallBack();
    } else if (
      tryServer &&
      mode === 'fallback' &&
      (status === 'signed-out' || status === 'fallback-expired')
    ) {
      void refresh(null);
    }
  }

  function onVisibility() {
    if (doc.visibilityState !== 'visible') return;
    // Timers of a hidden tab are throttled; check the moment it shows again.
    schedule();
    followRelayFlag();
  }

  function onOnline() {
    if (snapshot.status === 'offline') void refresh(null);
    else if (session) schedule();
  }

  function track(result: Promise<SignInResult>): Promise<SignInResult> {
    pendingSignIn = result.finally(() => {
      pendingSignIn = null;
    });
    return pendingSignIn;
  }

  async function finishGis(
    result: GisResult,
    attempt: GisAttempt
  ): Promise<SignInResult> {
    let outcome: SignInResult;
    if (result.kind === 'error') {
      outcome =
        result.error.type === 'popup_failed_to_open'
          ? 'blocked'
          : result.error.type === 'popup_closed'
            ? 'cancelled'
            : 'error';
    } else {
      const { access_token, expires_in, scope, error } = result.response;
      const expiresIn = Number(expires_in);
      if (error) {
        outcome = error === 'access_denied' ? 'cancelled' : 'error';
      } else if (!access_token || !(expiresIn > 0)) {
        outcome = 'error';
      } else {
        outcome = await acceptOwnToken(
          { accessToken: access_token, expiresIn, scope: scope ?? null },
          'fallback',
          attempt.intentional,
          attempt.asked
        );
      }
    }
    // Read after the await: a click on Reconnect may have joined it meanwhile.
    if (gisAttempt === attempt) gisAttempt = null;
    const { intentional } = attempt;
    // A renewal that failed without being asked for waits for a new token.
    if (!intentional && outcome !== 'done') gestureBlocked = true;
    update({
      signingIn: false,
      error: !intentional
        ? snapshot.error
        : outcome === 'blocked'
          ? 'popup-blocked'
          : outcome === 'error'
            ? 'failed'
            : null,
    });
    return outcome;
  }

  /**
   * The sign-in already open, when there is one. A click that asked for one
   * makes a renewal the same click started its own, so its failure is shown.
   */
  function joinPending(intentional: boolean): Promise<SignInResult> | null {
    if (intentional && gisAttempt) gisAttempt.intentional = true;
    return pendingSignIn;
  }

  /** Opens the token client; the caller is a click handler, since GIS opens a popup at once. */
  function requestGisToken(
    request: GisTokenRequest,
    intentional: boolean
  ): Promise<SignInResult> {
    const pending = joinPending(intentional);
    if (pending) return pending;
    const client = tokenClient;
    if (!client) {
      ensureGis();
      return Promise.resolve('error');
    }
    const attempt: GisAttempt = { intentional, asked: askedNow() };
    gisAttempt = attempt;
    update({ signingIn: true, error: null });
    const result = new Promise<GisResult>(resolve => {
      gisPending = resolve;
    });
    client.requestAccessToken(request);
    return track(result.then(settled => finishGis(settled, attempt)));
  }

  async function finishPopup(
    outcome: OAuthPopupOutcome
  ): Promise<SignInResult> {
    let result: SignInResult = outcome.kind;
    if (outcome.kind === 'done') {
      result = await acceptOwnToken(outcome.token, 'server', true);
    } else if (outcome.kind === 'unavailable') {
      fallBack();
    } else if (outcome.kind === 'scope-missing') {
      clearSession('scope-missing', 'server');
    }
    update({
      signingIn: false,
      error:
        result === 'blocked'
          ? 'popup-blocked'
          : result === 'error'
            ? 'failed'
            : null,
    });
    return result;
  }

  /**
   * Sign in, or Try again: the relay's popup, or the token client until the
   * midnight the tabs share, read again here. Call it inside the click handler.
   * A login hint picks the account, as a Drive state's userId does.
   */
  function signIn({
    loginHint = null,
  }: { loginHint?: string | null } = {}): Promise<SignInResult> {
    const pending = joinPending(true);
    if (pending) return pending;
    if (!shouldTryServer(storage, now())) {
      if (snapshot.mode === 'server') {
        // Another tab found the relay unavailable since this one decided.
        fallBack();
        if (!tokenClient) return Promise.resolve('unavailable');
      }
      return requestGisToken(
        loginHint
          ? { prompt: '', login_hint: loginHint }
          : { prompt: 'select_account' },
        true
      );
    }
    // A new sign-in ends the one before it, late listening included.
    popup?.dispose();
    popup = openOAuthPopup(
      {
        open: openWindow,
        createChannel,
        requestToken: async (callbackSucceeded, callbackReport) => {
          // A pending logout would clear the cookie of a callback whose report
          // is still on its way, so a close waits a moment for that report.
          const succeeded =
            callbackSucceeded ||
            (isLogoutPending(storage) && (await callbackReport()));
          // The callback's cookie replaced the one a pending logout was for.
          if (succeeded) recordLogoutPending(storage, false);
          return relayToken();
        },
        recordUnavailable: () => recordServerUnavailable(storage, now()),
      },
      {
        loginHint,
        onLate: outcome => {
          if (outcome.kind === 'done') {
            void acceptOwnToken(outcome.token, 'server', true);
          } else if (outcome.kind === 'scope-missing') {
            clearSession('scope-missing', 'server');
          }
        },
      }
    );
    update({ signingIn: true, error: null });
    return track(popup.result.then(finishPopup));
  }

  /** Whether the relay cleared its cookie; unconfirmed, the next token request logs out first. */
  function logOutAtRelay(): Promise<boolean> {
    loggingOut = loggingOut.then(async () => {
      const confirmed = await requestRelayLogout({ fetch: send });
      recordLogoutPending(storage, !confirmed);
      return confirmed;
    });
    return loggingOut;
  }

  /**
   * A sign-out ends the sign-ins still open: the popup closes, and should its
   * callback still set a cookie, the relay logs out again.
   */
  function endSignIns() {
    popup?.abandon(() => void logOutAtRelay());
    settleGis({ kind: 'error', error: { type: 'popup_closed' } });
  }

  /** Reconnect Google past midnight: the cookie the fallback kept, without a popup. */
  async function reconnectThroughRelay(): Promise<SignInResult> {
    await refresh(session?.accessToken ?? null);
    if (session) return 'done';
    return RECONNECT_RESULTS[snapshot.status] ?? 'error';
  }

  async function getAccessToken(): Promise<string> {
    if (session && now() < session.expiresAt - EXPIRY_SKEW_MS) {
      return session.accessToken;
    }
    if (session?.mode === 'server') {
      await refresh(session.accessToken);
      if (session && now() < session.expiresAt - EXPIRY_SKEW_MS) {
        return session.accessToken;
      }
    } else if (session) {
      expireFallback();
    }
    throw new TokenUnavailableError(snapshot.status);
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Joins the other tabs and finds the token: theirs, the relay's, or none. */
    start(): Promise<void> {
      started ??= (async () => {
        channel = createChannel(TOKEN_CHANNEL);
        channel.addEventListener('message', onMessage);
        events.addEventListener('click', onGesture, true);
        events.addEventListener('keyup', onGesture, true);
        events.addEventListener('online', onOnline);
        doc.addEventListener('visibilitychange', onVisibility);
        if (shouldTryServer(storage, now())) await refresh(null);
        else if (!(await adoptFromTabs(null))) fallBack();
      })();
      return started;
    },

    signIn,

    /** The Cancel of "Waiting for Google sign-in…". */
    cancelSignIn() {
      popup?.cancel();
    },

    /**
     * Reconnect Google: the token client again, with this account. Past the
     * recorded midnight one token request to the relay decides instead, and a
     * 401 leaves Sign in. Outside the fallback, the relay's popup.
     */
    reconnect(): Promise<SignInResult> {
      const account = snapshot.account;
      if (snapshot.mode !== 'fallback') {
        return signIn({ loginHint: account?.sub ?? null });
      }
      if (shouldTryServer(storage, now())) return reconnectThroughRelay();
      gestureBlocked = false;
      return requestGisToken(
        account
          ? { prompt: '', login_hint: account.sub }
          : { prompt: 'select_account' },
        true
      );
    },

    /** A token for a Drive call, renewed first when it is about to expire. */
    getAccessToken,

    /**
     * Drive answered 401 for stale. A token renewed since is handed over, so a
     * late 401 cannot undo a renewal; otherwise the relay renews once, and a
     * fallback token waits for Reconnect Google.
     */
    async onUnauthorized(stale: string): Promise<string> {
      if (session && session.accessToken !== stale) return getAccessToken();
      if (session?.mode === 'server') {
        await refresh(stale);
        if (session && session.accessToken !== stale) {
          return session.accessToken;
        }
      } else if (session) {
        expireFallback();
      }
      throw new TokenUnavailableError(snapshot.status);
    },

    /** Drive's 403 for a token without drive.file. */
    reportInsufficientScope() {
      clearSession('scope-missing');
    },

    /**
     * Signs every tab out and revokes the grant; true once the relay confirmed
     * it cleared its cookie. Otherwise a live token is revoked at Google, and
     * the logout goes ahead of the next token request, in any tab or visit.
     */
    async signOut(): Promise<boolean> {
      const previous = session;
      // A sign-in still open must not bring the account back afterwards.
      endSignIns();
      markSignedOut(now());
      clearSession('signed-out', snapshot.mode, true);
      post({ type: 'signed-out', at: signedOutAt, fromSignOut: true });
      let revoked = false;
      if (previous?.mode === 'fallback' && oauth2) {
        try {
          oauth2.revoke(previous.accessToken);
          revoked = true;
        } catch {
          // The relay's logout below still revokes the grant.
        }
      }
      const confirmed = await logOutAtRelay();
      if (!confirmed && !revoked && previous && now() < previous.expiresAt) {
        await revokeAtGoogle(send, previous.accessToken);
      }
      return confirmed;
    },

    dispose() {
      disposed = true;
      clearTimers();
      popup?.dispose();
      popup = null;
      channel?.removeEventListener('message', onMessage);
      channel?.close();
      channel = null;
      events.removeEventListener('click', onGesture, true);
      events.removeEventListener('keyup', onGesture, true);
      events.removeEventListener('online', onOnline);
      doc.removeEventListener('visibilitychange', onVisibility);
      listeners.clear();
    },
  };
}

export type TokenManager = ReturnType<typeof createTokenManager>;
