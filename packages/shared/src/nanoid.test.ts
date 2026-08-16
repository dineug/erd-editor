import { urlAlphabet } from 'nanoid';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { nanoid } from '@/nanoid';

const alphabet = new Set(urlAlphabet.split(''));

describe('nanoid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
  });

  it('derives every character from the bytes globalThis.crypto.getRandomValues returns', () => {
    const bytesFilledWith = (value: number) =>
      vi
        .spyOn(globalThis.crypto, 'getRandomValues')
        .mockImplementation((array: any) => {
          new Uint8Array(array.buffer).fill(value);
          return array;
        });

    const zeroed = bytesFilledWith(0);
    expect(nanoid()).toBe(urlAlphabet[0].repeat(21));
    zeroed.mockRestore();

    const ones = bytesFilledWith(1);
    expect(nanoid()).toBe(urlAlphabet[1].repeat(21));
    ones.mockRestore();
  });

  it('has no fallback randomness source beyond globalThis.crypto', () => {
    const getRandomValues = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(() => {
        throw new Error('boom');
      });

    expect(() => nanoid()).toThrowError('boom');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });
});
