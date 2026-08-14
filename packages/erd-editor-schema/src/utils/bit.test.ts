import { describe, expect, it } from 'vitest';

import { bHas } from '@/utils/bit';

describe('bHas', () => {
  it('is true when every bit of value is set on bit', () => {
    expect(bHas(0b0101, 0b0001)).toBe(true);
    expect(bHas(0b0101, 0b0100)).toBe(true);
    expect(bHas(0b0101, 0b0101)).toBe(true);
  });

  it('is false when any bit of value is missing on bit', () => {
    expect(bHas(0b0101, 0b0010)).toBe(false);
    expect(bHas(0b0101, 0b0111)).toBe(false);
    expect(bHas(0b0000, 0b0001)).toBe(false);
  });

  it('treats a zero mask as always present', () => {
    expect(bHas(0, 0)).toBe(true);
    expect(bHas(0b1010, 0)).toBe(true);
  });

  it('handles the 31st bit used by the schema flags', () => {
    const flag = 0b1000000000000000000000000000000;

    expect(bHas(flag, flag)).toBe(true);
    expect(bHas(flag - 1, flag)).toBe(false);
  });

  it('works with negative numbers through two complement semantics', () => {
    expect(bHas(-1, 0b1111)).toBe(true);
    expect(bHas(-2, 0b0001)).toBe(false);
  });
});
