import { randomBase64Url } from '@/server/auth/base64url';
import { AUTH_CHANNEL, CALLBACK_MARKER } from '@/server/auth/callbackPage';
import {
  RELAY_START_PATH,
  type RelayToken,
  type RelayTokenResult,
} from '@/services/gdrive/authMode';
import type { CreateChannel } from '@/services/gdrive/types';

export const POPUP_NAME = 'erd-editor-google-auth';
export const POPUP_FEATURES = 'popup,width=500,height=640';
export const POPUP_TIMEOUT_MS = 5 * 60_000;
export const POPUP_POLL_MS = 500;

/** The window.open result as far as the popup is watched; Window fits it. */
export type PopupWindowLike = {
  readonly closed: boolean;
  close(): void;
  readonly location: { readonly href: string };
  readonly document: Pick<Document, 'readyState' | 'querySelector'>;
};

export type OAuthPopupOutcome =
  | { kind: 'done'; token: RelayToken }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'blocked' }
  | { kind: 'scope-missing' }
  | { kind: 'error' };

export type OAuthPopupDeps = {
  /** Called without a receiver: pass (url, target, features) => window.open(url, target, features). */
  open: (
    url: string,
    target: string,
    features: string
  ) => PopupWindowLike | null;
  createChannel: CreateChannel;
  /** POST /api/auth/token, classified by its JSON contract. */
  requestToken: () => Promise<RelayTokenResult>;
  /** Remembers the relay as unavailable until UTC midnight. */
  recordUnavailable: () => void;
  createAttempt?: () => string;
};

export type OAuthPopupOptions = {
  loginHint?: string | null;
  /** A sign-in that finishes after the popup already counted as cancelled. */
  onLate?: (outcome: OAuthPopupOutcome) => void;
};

export type OAuthPopup = {
  result: Promise<OAuthPopupOutcome>;
  /** Ends the wait as a closed popup would. */
  cancel: () => void;
  /** Stops watching and settles as cancelled, asking the relay nothing: signing out, leaving. */
  dispose: () => void;
};

type OAuthDone = { attempt: string; ok: boolean; error: string | null };

function readOAuthDone(data: unknown): OAuthDone | null {
  if (typeof data !== 'object' || data === null) return null;
  const { type, attempt, ok, error } = data as Record<string, unknown>;
  if (
    type !== 'oauth-done' ||
    typeof attempt !== 'string' ||
    typeof ok !== 'boolean'
  ) {
    return null;
  }
  return { attempt, ok, error: typeof error === 'string' ? error : null };
}

function failureOutcome(error: string | null): OAuthPopupOutcome {
  if (error === 'access_denied') return { kind: 'cancelled' };
  if (error === 'scope_missing') return { kind: 'scope-missing' };
  return { kind: 'error' };
}

/**
 * A same-origin page that finished loading without the callback's marker: the
 * SPA a missing _routes.json serves, or a 1027 page. Google's pages throw on
 * access and about:blank is the popup before its first load, so both wait.
 */
function isStrayPage(popup: PopupWindowLike): boolean {
  try {
    if (popup.location.href === 'about:blank') return false;
    const doc = popup.document;
    return (
      doc.readyState === 'complete' &&
      !doc.querySelector(`meta[name="${CALLBACK_MARKER}"]`)
    );
  } catch {
    return false;
  }
}

export function startUrl(attempt: string, loginHint: string | null): string {
  const params = new URLSearchParams({ attempt });
  if (loginHint) params.set('login_hint', loginHint);
  return `${RELAY_START_PATH}?${params}`;
}

/**
 * Opens the relay's sign-in popup; call it in the click handler. The result is
 * this attempt's oauth-done, or else one token request once the popup closes,
 * strays, times out or is cancelled, classified like any other.
 */
export function openOAuthPopup(
  deps: OAuthPopupDeps,
  { loginHint = null, onLate }: OAuthPopupOptions = {}
): OAuthPopup {
  const {
    open,
    createChannel,
    requestToken,
    recordUnavailable,
    createAttempt = () => randomBase64Url(16),
  } = deps;
  const attempt = createAttempt();
  const popup = open(startUrl(attempt, loginHint), POPUP_NAME, POPUP_FEATURES);
  if (!popup) {
    return {
      result: Promise.resolve({ kind: 'blocked' }),
      cancel: () => {},
      dispose: () => {},
    };
  }

  let phase: 'waiting' | 'finishing' | 'late' | 'over' = 'waiting';
  let timedOut = false;
  let settle: (outcome: OAuthPopupOutcome) => void = () => {};
  const result = new Promise<OAuthPopupOutcome>(resolve => {
    settle = resolve;
  });
  const channel = createChannel(AUTH_CHANNEL);

  const classify = async (
    afterSuccess: boolean
  ): Promise<OAuthPopupOutcome> => {
    const token = await requestToken().catch((): RelayTokenResult => ({
      kind: 'unavailable',
    }));
    switch (token.kind) {
      case 'token':
        return { kind: 'done', token: token.token };
      case 'signed-out':
        return { kind: afterSuccess ? 'error' : 'cancelled' };
      case 'unavailable':
        recordUnavailable();
        return { kind: 'unavailable' };
      default:
        return { kind: 'error' };
    }
  };
  const fromMessage = (done: OAuthDone): Promise<OAuthPopupOutcome> =>
    done.ok ? classify(true) : Promise.resolve(failureOutcome(done.error));

  const stop = () => {
    phase = 'over';
    clearInterval(poll);
    clearTimeout(deadline);
    channel.removeEventListener('message', onMessage);
    channel.close();
  };
  const leave = () => {
    phase = 'finishing';
    clearInterval(poll);
    popup.close();
  };

  const terminate = () => {
    if (phase !== 'waiting') return;
    leave();
    void classify(false).then(outcome => {
      if (phase === 'over') return;
      // A popup closed early by COOP may still finish; keep listening for it.
      if (outcome.kind === 'cancelled' && !timedOut) phase = 'late';
      else stop();
      settle(outcome);
    });
  };

  const onMessage = (event: MessageEvent) => {
    const done = readOAuthDone(event.data);
    if (!done || done.attempt !== attempt) return;
    if (phase === 'waiting') {
      leave();
      void fromMessage(done).then(outcome => {
        stop();
        settle(outcome);
      });
    } else if (phase === 'late') {
      phase = 'finishing';
      void fromMessage(done).then(outcome => {
        stop();
        onLate?.(outcome);
      });
    }
  };

  const poll = setInterval(() => {
    if (popup.closed || isStrayPage(popup)) terminate();
  }, POPUP_POLL_MS);
  const deadline = setTimeout(() => {
    timedOut = true;
    if (phase === 'waiting') terminate();
    else if (phase === 'late') stop();
  }, POPUP_TIMEOUT_MS);
  channel.addEventListener('message', onMessage);

  return {
    result,
    cancel: terminate,
    dispose: () => {
      stop();
      settle({ kind: 'cancelled' });
    },
  };
}
