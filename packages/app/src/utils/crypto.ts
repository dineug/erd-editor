import { decodeBase64, encodeBase64 } from '@/utils/base64';

type EncryptValue = {
  encrypted: ArrayBuffer;
  // Pinned to ArrayBuffer rather than the default ArrayBufferLike, which both
  // consumers require: a BufferSource excludes a shared-backed view, and
  // encodeBase64 takes an ArrayBuffer. TypeScript rejects the unpinned form.
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
    encrypted: encodeBase64(encrypted),
    // .buffer, not the view: generateIv allocates its 12 bytes and never
    // subarrays them, so the encoded string is unchanged and anything already
    // stored stays decryptable. crypto.test.ts holds the frozen witness.
    iv: encodeBase64(iv.buffer),
  };
}

export function decryptFromJson(
  { encrypted, iv }: EncryptJson,
  key: CryptoKey
): Promise<string> {
  return decrypt(decodeBase64(encrypted), decodeBase64(iv), key);
}
