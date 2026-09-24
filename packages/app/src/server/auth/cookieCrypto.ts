import { decodeBase64Url, encodeBase64Url } from './base64url';

export type CookieKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function importCookieKey(
  raw: Uint8Array<ArrayBuffer>
): Promise<CookieKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * AES-256-GCM as v1.base64url(iv and ciphertext). The additional data names the
 * cookie, so a value sealed for one cookie does not open as another.
 */
export async function sealValue(
  key: CookieKey,
  plaintext: string,
  aad: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(plaintext)
  );
  const sealed = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  sealed.set(iv);
  sealed.set(new Uint8Array(ciphertext), IV_BYTES);
  return `${VERSION}.${encodeBase64Url(sealed)}`;
}

/** Null for a value that is malformed, tampered with, or sealed by another key or for another cookie. */
export async function openValue(
  key: CookieKey,
  value: string,
  aad: string
): Promise<string | null> {
  const [version, body, ...rest] = value.split('.');
  if (version !== VERSION || rest.length > 0) return null;
  const sealed = decodeBase64Url(body ?? '');
  if (!sealed || sealed.length < IV_BYTES + TAG_BYTES) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: sealed.subarray(0, IV_BYTES),
        additionalData: encoder.encode(aad),
      },
      key,
      sealed.subarray(IV_BYTES)
    );
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}
