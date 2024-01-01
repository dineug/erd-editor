type EncryptValue = {
  encrypted: ArrayBuffer;
  iv: Uint8Array;
};

export type EncryptJson = {
  encrypted: number[];
  iv: number[];
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
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 128,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

export function importKey(key: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
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
  return window.crypto.subtle.exportKey('jwk', key);
}

function generateIv(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

async function encrypt(value: string, key: CryptoKey): Promise<EncryptValue> {
  const iv = generateIv();
  const encrypted = await window.crypto.subtle.encrypt(
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
  encrypted: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey
): Promise<string> {
  const value = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encrypted
  );
  return decode(value);
}

function pack(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer));
}

function unpack(value: number[]) {
  return new Uint8Array(value);
}

export async function encryptToJson(
  value: string,
  key: CryptoKey
): Promise<EncryptJson> {
  const { encrypted, iv } = await encrypt(value, key);
  return {
    encrypted: pack(encrypted),
    iv: pack(iv),
  };
}

export function decryptFromJson(
  { encrypted, iv }: EncryptJson,
  key: CryptoKey
): Promise<string> {
  return decrypt(unpack(encrypted), unpack(iv), key);
}
