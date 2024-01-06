import { customRandom, urlAlphabet } from 'nanoid';

export const nanoid = customRandom(urlAlphabet, 21, size => {
  let crypto = globalThis.crypto;
  if (crypto === undefined) {
    crypto = require('node:crypto').webcrypto;
  }
  return crypto.getRandomValues(new Uint8Array(size));
});
