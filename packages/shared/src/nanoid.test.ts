import { createRequire } from 'node:module';

import { urlAlphabet } from 'nanoid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nanoid } from '@/nanoid';

const alphabet = new Set(urlAlphabet.split(''));

describe('nanoid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('generates a 21 character id', () => {
    expect(nanoid()).toHaveLength(21);
  });

  it('only uses characters from the url alphabet', () => {
    for (const char of nanoid()) {
      expect(alphabet.has(char)).toBe(true);
    }
  });

  it('generates unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nanoid()));

    expect(ids.size).toBe(1000);
  });

  it('draws its randomness from globalThis.crypto.getRandomValues', () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');

    const id = nanoid();

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(getRandomValues.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(id).toHaveLength(21);

    getRandomValues.mockRestore();
  });

  it('falls back to node:crypto webcrypto when globalThis.crypto is undefined', async () => {
    vi.stubGlobal('crypto', undefined);
    vi.stubGlobal('require', createRequire(import.meta.url));
    vi.resetModules();

    const { nanoid: fallbackNanoid } = await import('@/nanoid');
    const id = fallbackNanoid();

    expect(id).toHaveLength(21);
    for (const char of id) {
      expect(alphabet.has(char)).toBe(true);
    }
  });
});
