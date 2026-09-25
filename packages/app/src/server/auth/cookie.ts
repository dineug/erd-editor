/**
 * The refresh token and the time of the consent behind it, sealed. Strict
 * because only the app's own requests carry it; 180 days, renewed on every
 * refresh, and never past a year from that consent.
 */
export const REFRESH_COOKIE = '__Host-erd_gdrive_rt';
export const REFRESH_COOKIE_AAD = `${REFRESH_COOKIE}|v1`;
export const REFRESH_COOKIE_MAX_AGE = 15_552_000;
export const REFRESH_COOKIE_ABSOLUTE_MAX_AGE = 31_536_000;

/**
 * State, PKCE verifier and attempt for one sign-in, sealed. Lax because Google
 * sends the popup back with a cross-site navigation, which drops Strict cookies.
 */
export const STATE_COOKIE = '__Host-erd_oauth';
export const STATE_COOKIE_AAD = `${STATE_COOKIE}|v1`;
export const STATE_COOKIE_MAX_AGE = 600;

function serialize(
  name: string,
  value: string,
  maxAge: number,
  sameSite: 'Strict' | 'Lax'
): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=${sameSite}`;
}

export function refreshCookie(
  value: string,
  maxAge: number = REFRESH_COOKIE_MAX_AGE
): string {
  return serialize(REFRESH_COOKIE, value, maxAge, 'Strict');
}

export function clearRefreshCookie(): string {
  return serialize(REFRESH_COOKIE, '', 0, 'Strict');
}

export function stateCookie(value: string): string {
  return serialize(STATE_COOKIE, value, STATE_COOKIE_MAX_AGE, 'Lax');
}

export function clearStateCookie(): string {
  return serialize(STATE_COOKIE, '', 0, 'Lax');
}

/**
 * The space and tab a Cookie header puts around a pair, and nothing else: a
 * name padded with other whitespace is another cookie, one without the prefix.
 */
const trimPair = (text: string) => text.replace(/^[ \t]+|[ \t]+$/g, '');

/** The first cookie of exactly that name, or null when it is missing or empty. */
export function readCookie(request: Request, name: string): string | null {
  for (const pair of (request.headers.get('Cookie') ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && trimPair(pair.slice(0, separator)) === name) {
      return trimPair(pair.slice(separator + 1)) || null;
    }
  }
  return null;
}
