import { decodeBase64Url } from './base64url';

/**
 * The Pages variables the relay reads: two secrets, and the client id that is
 * also a build variable. Each may be missing, as on a fork or a preview.
 */
export type AuthEnv = {
  GOOGLE_CLIENT_SECRET?: string;
  COOKIE_KEY?: string;
  VITE_GOOGLE_CLIENT_ID?: string;
};

export type AuthConfig = {
  clientId: string;
  clientSecret: string;
  cookieKey: Uint8Array<ArrayBuffer>;
};

const COOKIE_KEY_BYTES = 32;

/** The 32 bytes of an AES-256 key, written as base64 or base64url, padded or not. */
export function parseCookieKey(
  value: string | undefined
): Uint8Array<ArrayBuffer> | null {
  const bytes = decodeBase64Url(
    (value ?? '')
      .trim()
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  );
  return bytes?.length === COOKIE_KEY_BYTES ? bytes : null;
}

/** Null unless all three are set, which is the relay's not-configured state. */
export function parseAuthEnv(env: AuthEnv): AuthConfig | null {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const cookieKey = parseCookieKey(env.COOKIE_KEY);
  if (!clientId || !clientSecret || !cookieKey) return null;
  return { clientId, clientSecret, cookieKey };
}
