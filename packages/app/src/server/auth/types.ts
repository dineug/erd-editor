import type { CallbackError } from './callbackPage';

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

/** What the relay logs: an event name and nothing else, never a token, cookie, code or URL. */
export type AuthEvent =
  | 'auth.start'
  | `auth.callback.${'ok' | CallbackError}`
  | 'auth.token.invalid_grant'
  | 'auth.token.unreadable_cookie'
  | 'auth.upstream.retry'
  | 'auth.logout'
  | 'auth.not_configured'
  | 'auth.error';

/**
 * What the runtime hands the relay. Pass fetch as a function of its own: workerd
 * and Chrome throw Illegal invocation on a fetch called through another object.
 */
export type AuthDeps = {
  fetch: FetchLike;
  tokenUrl?: string;
  revokeUrl?: string;
  now?: () => number;
  log?: (event: AuthEvent) => void;
};

export type ResolvedAuthDeps = Required<AuthDeps>;
