import { encodeBase64Url, randomBase64Url } from './base64url';
import { STATE_COOKIE_AAD, STATE_COOKIE_MAX_AGE } from './cookie';
import { type CookieKey, openValue, sealValue } from './cookieCrypto';

/** One sign-in, sealed into the state cookie between start and callback. */
export type OAuthState = {
  state: string;
  verifier: string;
  attempt: string | null;
  loginHint: string | null;
  expiresAt: number;
};

/** The opener's attempt id: 16 random bytes in base64url. */
export const ATTEMPT_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const LOGIN_HINT_MAX_LENGTH = 256;
const SUBJECT_PATTERN = /^[0-9]+$/;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;

const encoder = new TextEncoder();

/** An account id or an email address, the two things a Drive state or a person supplies. */
export function isLoginHint(value: string): boolean {
  return (
    value.length <= LOGIN_HINT_MAX_LENGTH &&
    (SUBJECT_PATTERN.test(value) || EMAIL_PATTERN.test(value))
  );
}

export function createOAuthState(
  attempt: string | null,
  loginHint: string | null,
  now: number
) {
  return {
    state: randomBase64Url(32),
    verifier: randomBase64Url(32),
    attempt,
    loginHint,
    expiresAt: now + STATE_COOKIE_MAX_AGE * 1000,
  } satisfies OAuthState;
}

/** The S256 code challenge of a PKCE verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(verifier)
  );
  return encodeBase64Url(new Uint8Array(digest));
}

export function sealOAuthState(
  key: CookieKey,
  value: OAuthState
): Promise<string> {
  return sealValue(key, JSON.stringify(value), STATE_COOKIE_AAD);
}

function isOAuthState(value: unknown): value is OAuthState {
  const candidate = (value ?? {}) as Record<string, unknown>;
  return (
    typeof candidate.state === 'string' &&
    typeof candidate.verifier === 'string' &&
    (candidate.attempt === null || typeof candidate.attempt === 'string') &&
    (candidate.loginHint === null || typeof candidate.loginHint === 'string') &&
    typeof candidate.expiresAt === 'number'
  );
}

/** Null for a cookie that does not open, holds another shape, or has expired. */
export async function openOAuthState(
  key: CookieKey,
  sealed: string,
  now: number
): Promise<OAuthState | null> {
  const plaintext = await openValue(key, sealed, STATE_COOKIE_AAD);
  let value: unknown = null;
  try {
    value = JSON.parse(plaintext ?? 'null');
  } catch {
    return null;
  }
  return isOAuthState(value) && now <= value.expiresAt ? value : null;
}

/** String comparison whose time depends on the length alone. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}
