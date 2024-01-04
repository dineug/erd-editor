import * as base64 from 'base64-arraybuffer';

type EncryptValue = {
  encrypted: ArrayBuffer;
  iv: Uint8Array;
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

function generateIv(): Uint8Array {
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
    iv: base64.encode(iv),
  };
}

export function decryptFromJson(
  { encrypted, iv }: EncryptJson,
  key: CryptoKey
): Promise<string> {
  return decrypt(base64.decode(encrypted), base64.decode(iv), key);
}
