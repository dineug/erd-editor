const BASE64URL = /^[A-Za-z0-9_-]*$/;

/** Unpadded base64url, the alphabet a cookie value, a URL and a CSP nonce all take as it is. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Null for anything that is not unpadded base64url, so a forged value never reaches a decoder. */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL.test(value) || value.length % 4 === 1) return null;
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomBase64Url(byteLength: number): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}
