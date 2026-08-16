import { describe, expect, it } from 'vite-plus/test';

import { bHas } from '@/utils/bit';

describe('bHas', () => {
  it('returns true when every bit of value is set in bit', () => {
    expect(bHas(0b1010, 0b0010)).toBe(true);
    expect(bHas(0b1010, 0b1000)).toBe(true);
    expect(bHas(0b1010, 0b1010)).toBe(true);
  });

  it('returns false when any bit of value is missing', () => {
    expect(bHas(0b1010, 0b0100)).toBe(false);
    expect(bHas(0b1010, 0b1110)).toBe(false);
    expect(bHas(0b0000, 0b0001)).toBe(false);
  });

  it('treats a zero mask as always present', () => {
    expect(bHas(0, 0)).toBe(true);
    expect(bHas(0b1111, 0)).toBe(true);
  });

  it('works with real flag combinations', () => {
    const read = 0b001;
    const write = 0b010;
    const exec = 0b100;
    const mode = read | exec;

    expect(bHas(mode, read)).toBe(true);
    expect(bHas(mode, exec)).toBe(true);
    expect(bHas(mode, write)).toBe(false);
    expect(bHas(mode, read | exec)).toBe(true);
    expect(bHas(mode, read | write)).toBe(false);
  });
});
