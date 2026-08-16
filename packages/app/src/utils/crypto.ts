import * as base64 from 'base64-arraybuffer';

type EncryptValue = {
  encrypted: ArrayBuffer;
  // Pinned to `ArrayBuffer` rather than the default `ArrayBufferLike`. Both
  // consumers below require it: `AesGcmParams.iv` is a `BufferSource`, which
  // excludes a `SharedArrayBuffer`-backed view, and `base64.encode` takes an
  // `ArrayBuffer`. The value always satisfies this — `generateIv` allocates its
  // own buffer — but only TypeScript 5.7+ can say so, and TypeScript 7 rejects
  // the unpinned form outright (TS2769 at the `encrypt` call, TS2345 at `encode`).
  iv: Uint8Array<ArrayBuffer>;
};

export type EncryptJson = {
  encrypted: string;
  iv: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encode(value: string) {
  return textEncoder.encode(value);
}

function decode(value: ArrayBuffer) {
  return textDecoder.decode(value);
}

export function generateKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 128,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export function importKey(key: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'jwk',
    {
      alg: 'A128GCM',
      ext: true,
      k: key,
      key_ops: ['encrypt', 'decrypt'],
      kty: 'oct',
    },
    {
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export function exportKey(key: CryptoKey): Promise<JsonWebKey> {
  return globalThis.crypto.subtle.exportKey('jwk', key);
}

function generateIv(): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(12));
}

async function encrypt(value: string, key: CryptoKey): Promise<EncryptValue> {
  const iv = generateIv();
  const encrypted = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encode(value)
  );
  return { encrypted, iv };
}

async function decrypt(
  encrypted: ArrayBuffer,
  iv: ArrayBuffer,
  key: CryptoKey
): Promise<string> {
  const value = await globalThis.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encrypted
  );
  return decode(value);
}

export async function encryptToJson(
  value: string,
  key: CryptoKey
): Promise<EncryptJson> {
  const { encrypted, iv } = await encrypt(value, key);
  return {
    encrypted: base64.encode(encrypted),
    // `.buffer`, not the view. `generateIv` allocates exactly 12 bytes and never
    // subarrays them, so byteOffset is 0 and byteLength covers the whole buffer —
    // the encoded string is byte-for-byte what it was before. Anything already
    // stored stays decryptable; `crypto.test.ts` holds a frozen ciphertext and a
    // length assertion that both go red if that ever stops being true.
    iv: base64.encode(iv.buffer),
  };
}

export function decryptFromJson(
  { encrypted, iv }: EncryptJson,
  key: CryptoKey
): Promise<string> {
  return decrypt(base64.decode(encrypted), base64.decode(iv), key);
}
