import { customRandom, urlAlphabet } from 'nanoid';

export const nanoid = customRandom(urlAlphabet, 21, size =>
  globalThis.crypto.getRandomValues(new Uint8Array(size))
);
