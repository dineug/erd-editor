import { describe, expect, it } from 'vite-plus/test';

import { createUuidv7, uuidv7 } from './uuidv7';

const hyphenated = (bytes: Uint8Array) => {
  const hex = Array.from(bytes, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** A clock and a random source that hand out the given values in turn. */
const fixed = (times: number[], words: number[][]) => ({
  now: () => times.shift()!,
  random: (array: Uint32Array) => {
    array.set(words.shift()!);
    return array;
  },
});

const NOW = 1_700_000_000_000;

describe('createUuidv7', () => {
  it('lays out the time, version, counter, variant and random bits as RFC 9562 does', () => {
    const next = createUuidv7(
      fixed([NOW], [[0xffffffff, 0x12345678, 0x9abcdef0]])
    );

    expect(hyphenated(next())).toBe('018bcfe5-6800-77fc-9234-56789abcdef0');
  });

  it('counts up within one millisecond and keeps drawing the random tail', () => {
    const next = createUuidv7(
      fixed(
        [NOW, NOW],
        [
          [0xffffffff, 0x12345678, 0x9abcdef0],
          [0, 0, 0x00000001],
        ]
      )
    );

    next();

    expect(hyphenated(next())).toBe('018bcfe5-6800-77fc-9234-567900000001');
  });

  it('carries the counter from the variant word into the version word', () => {
    const next = createUuidv7(
      fixed(
        [NOW, NOW],
        [
          [0, 0x3fffffff, 0],
          [0, 0, 0],
        ]
      )
    );

    expect(hyphenated(next())).toBe('018bcfe5-6800-7000-bfff-ffff00000000');
    expect(hyphenated(next())).toBe('018bcfe5-6800-7001-8000-000000000000');
  });

  it('seeds a new counter on a new millisecond', () => {
    const next = createUuidv7(
      fixed(
        [NOW, NOW + 1],
        [
          [0, 5, 0],
          [0, 1, 0],
        ]
      )
    );

    next();

    expect(hyphenated(next())).toBe('018bcfe5-6801-7000-8000-000100000000');
  });

  it('keeps the last time and counts on when the clock steps back', () => {
    const next = createUuidv7(
      fixed(
        [NOW, NOW - 5_000],
        [
          [0, 5, 0],
          [0, 0, 0],
        ]
      )
    );

    next();

    expect(hyphenated(next())).toBe('018bcfe5-6800-7000-8000-000600000000');
  });

  it('draws from the platform clock and crypto by default', () => {
    const before = Date.now();
    const bytes = uuidv7();
    const after = Date.now();
    const time = Number.parseInt(
      hyphenated(bytes).replace(/-/g, '').slice(0, 12),
      16
    );

    expect(time).toBeGreaterThanOrEqual(before);
    expect(time).toBeLessThanOrEqual(after);
    expect(bytes[6] >> 4).toBe(7);
    expect(bytes[8] >> 6).toBe(0b10);
  });

  it('hands out UUIDs in ascending order from one generator', () => {
    const values = Array.from({ length: 1_000 }, () => hyphenated(uuidv7()));

    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual(values);
  });
});
