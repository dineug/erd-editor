import { REFRESH_COOKIE_AAD } from './cookie';
import { type CookieKey, openValue, sealValue } from './cookieCrypto';

/**
 * What the refresh cookie holds: Google's refresh token, and when the person
 * last consented (epoch seconds), which a renewal keeps and a sign-in resets.
 */
export type RefreshGrant = { rt: string; iat: number };

function isRefreshGrant(value: unknown): value is RefreshGrant {
  const candidate = (value ?? {}) as Record<string, unknown>;
  return (
    typeof candidate.rt === 'string' &&
    candidate.rt.length > 0 &&
    Number.isSafeInteger(candidate.iat)
  );
}

export function sealRefreshGrant(
  key: CookieKey,
  grant: RefreshGrant
): Promise<string> {
  return sealValue(
    key,
    JSON.stringify({ rt: grant.rt, iat: grant.iat }),
    REFRESH_COOKIE_AAD
  );
}

/** Null for a cookie that does not open or holds another shape. */
export async function openRefreshGrant(
  key: CookieKey,
  sealed: string
): Promise<RefreshGrant | null> {
  const plaintext = await openValue(key, sealed, REFRESH_COOKIE_AAD);
  let value: unknown = null;
  try {
    value = JSON.parse(plaintext ?? 'null');
  } catch {
    return null;
  }
  return isRefreshGrant(value) ? { rt: value.rt, iat: value.iat } : null;
}
