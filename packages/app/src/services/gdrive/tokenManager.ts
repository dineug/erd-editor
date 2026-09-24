import { hasDriveFileScope, SCOPES } from '@/server/auth/google';
import {
  recordServerUnavailable,
  type RelayToken,
  type RelayTokenResult,
  requestRelayLogout,
  requestRelayToken,
  shouldTryServer,
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
  expiresAt: number;
  renewAt: number;
  scope: string | null;
  account: GoogleAccount;
  mode: RelayMode;
};

type TokenMessage =
  | { type: 'request' }
  | { type: 'token'; session: Session }
  | { type: 'signed-out' };

type GisResult =
  | { kind: 'response'; response: GisTokenResponse }
  | { kind: 'error'; error: GisError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSession(value: unknown): Session | null {
  if (!isRecord(value) || !isRecord(value.account)) return null;
  const { accessToken, expiresAt, renewAt, scope, account, mode } = value;
  const { sub, email } = account;
  if (
    typeof accessToken !== 'string' ||
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
    expiresAt,
    renewAt,
    scope,
    account: { sub, email },
    mode,
  };
}

function readTokenMessage(data: unknown): TokenMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === 'request' || data.type === 'signed-out') {
    return { type: data.type };
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

export async function fetchUserInfo(
  send: FetchLike,
  accessToken: string
): Promise<GoogleAccount> {
  const response = await send(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body: unknown = response.ok ? await response.json() : null;
  if (
    !isRecord(body) ||
    typeof body.sub !== 'string' ||
    typeof body.email !== 'string'
  ) {
    throw new Error('Google userinfo failed');
  }
  return { sub: body.sub, email: body.email };
}

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
  let gestureBlocked = false;
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
    update({
      status: next.mode,
      mode: next.mode,
      account: next.account,
      expiresAt: next.expiresAt,
      renewDue: false,
      error: null,
    });
    if (next.mode === 'fallback') ensureGis();
    schedule();
    if (broadcast) post({ type: 'token', session: next });
  };

  const clearSession = (status: TokenStatus, mode = snapshot.mode) => {
    session = null;
    clearTimers();
    update({
      status,
      mode,
      account: status === 'signed-out' ? null : snapshot.account,
      expiresAt: null,
      renewDue: status === 'fallback-expired',
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

  /** A token this tab obtained: its account read from userinfo, then shared. */
  async function acceptOwnToken(
    token: RelayToken,
    mode: RelayMode,
    intentional: boolean
  ): Promise<SignInResult> {
    if (lacksDriveScope(token.scope)) {
      clearSession('scope-missing', mode);
      return 'scope-missing';
    }
    const issuedAt = now();
    let account: GoogleAccount;
    try {
      account = await fetchUserInfo(send, token.accessToken);
    } catch {
      if (session) scheduleRetry();
      else update({ status: 'signed-out', mode, error: 'failed' });
      return 'error';
    }
    if (
      !intentional &&
      snapshot.account &&
      snapshot.account.sub !== account.sub
    ) {
      clearSession('account-changed');
      return 'error';
    }
    const expiresAt = issuedAt + token.expiresIn * 1000;
    setSession(
      {
        accessToken: token.accessToken,
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

  async function applyRelayResult(result: RelayTokenResult) {
    const hadSession = !!session;
    switch (result.kind) {
      case 'token':
        await acceptOwnToken(result.token, 'server', false);
        return;
      case 'signed-out':
        clearSession('signed-out', 'server');
        // The cookie is gone for every tab, not only this one.
        if (hadSession) post({ type: 'signed-out' });
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
   * Renews the token stale names, or finds the first one when stale is null.
   * Under the lock a tab first takes what another tab just renewed, so the
   * tabs of a browser call the relay once between them.
   */
  function refresh(stale: string | null): Promise<void> {
    refreshing ??= withLock(async () => {
      if (
        disposed ||
        snapshot.status === 'account-changed' ||
        isFresh(session, stale)
      ) {
        return;
      }
      if ((await adoptFromTabs(stale)) || disposed) return;
      if (!shouldTryServer(storage, now())) return fallBack();
      await applyRelayResult(
        await requestRelayToken({ fetch: send, isOnline })
      );
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  function adopt(incoming: Session) {
    if (
      snapshot.status === 'account-changed' ||
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
      if (session || snapshot.account) clearSession('signed-out');
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
      isEditingGesture(event)
    ) {
      return;
    }
    void requestGisToken({ prompt: '', login_hint: account.sub }, false);
  }

  function onVisibility() {
    // Timers of a hidden tab are throttled; check the moment it shows again.
    if (doc.visibilityState === 'visible') schedule();
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
    intentional: boolean
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
          intentional
        );
      }
    }
    // A renewal that failed without being asked for waits for Reconnect Google.
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

  /** Opens the token client; the caller is a click handler, since GIS opens a popup at once. */
  function requestGisToken(
    request: GisTokenRequest,
    intentional: boolean
  ): Promise<SignInResult> {
    if (pendingSignIn) return pendingSignIn;
    const client = tokenClient;
    if (!client) {
      ensureGis();
      return Promise.resolve('error');
    }
    update({ signingIn: true, error: null });
    const result = new Promise<GisResult>(resolve => {
      gisPending = resolve;
    });
    client.requestAccessToken(request);
    return track(result.then(settled => finishGis(settled, intentional)));
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
   * Sign in, or Try again: the relay's popup in the server mode, the token
   * client in the fallback. Call it inside the click handler. A login hint
   * picks the account, as a Drive state's userId does.
   */
  function signIn({
    loginHint = null,
  }: { loginHint?: string | null } = {}): Promise<SignInResult> {
    if (pendingSignIn) return pendingSignIn;
    if (snapshot.mode === 'fallback') {
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
        requestToken: () => requestRelayToken({ fetch: send, isOnline }),
        recordUnavailable: () => recordServerUnavailable(storage, now()),
      },
      {
        loginHint,
        onLate: outcome => {
          if (outcome.kind === 'done') {
            void acceptOwnToken(outcome.token, 'server', true);
          }
        },
      }
    );
    update({ signingIn: true, error: null });
    return track(popup.result.then(finishPopup));
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

    /** Reconnect Google: the token client again, with this account. */
    reconnect(): Promise<SignInResult> {
      if (snapshot.mode !== 'fallback') return signIn();
      gestureBlocked = false;
      const account = snapshot.account;
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
     * Signs every tab out and revokes the grant. In the fallback the relay is
     * asked too, so a shared computer keeps no refresh cookie behind.
     */
    async signOut(): Promise<void> {
      const previous = session;
      // A sign-in still open must not bring the account back afterwards.
      popup?.dispose();
      popup = null;
      settleGis({ kind: 'error', error: { type: 'popup_closed' } });
      clearSession('signed-out');
      post({ type: 'signed-out' });
      if (previous?.mode === 'fallback' && oauth2) {
        try {
          oauth2.revoke(previous.accessToken);
        } catch {
          // The relay's logout below still revokes the grant.
        }
      }
      await requestRelayLogout({ fetch: send });
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
