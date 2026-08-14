import { describe, expect, it } from 'vitest';

import { createInRange } from '@/number.utils';

describe('createInRange', () => {
  it('clamps values below min and above max', () => {
    const inRange = createInRange(0, 10);

    expect(inRange(-5)).toBe(0);
    expect(inRange(15)).toBe(10);
  });

  it('passes through values inside the range', () => {
    const inRange = createInRange(0, 10);

    expect(inRange(5)).toBe(5);
    expect(inRange(0.5)).toBe(0.5);
  });

  it('keeps the inclusive boundaries', () => {
    const inRange = createInRange(0, 10);

    expect(inRange(0)).toBe(0);
    expect(inRange(10)).toBe(10);
  });

  it('supports negative ranges', () => {
    const inRange = createInRange(-10, -2);

    expect(inRange(-20)).toBe(-10);
    expect(inRange(-5)).toBe(-5);
    expect(inRange(0)).toBe(-2);
  });

  it('collapses to a single value when min equals max', () => {
    const inRange = createInRange(3, 3);

    expect(inRange(1)).toBe(3);
    expect(inRange(3)).toBe(3);
    expect(inRange(9)).toBe(3);
  });

  it('returns max when min is greater than max because max is applied last', () => {
    const inRange = createInRange(10, 0);

    expect(inRange(5)).toBe(0);
    expect(inRange(100)).toBe(0);
    expect(inRange(-100)).toBe(0);
  });

  it('propagates NaN and handles infinities', () => {
    const inRange = createInRange(0, 10);

    expect(inRange(NaN)).toBeNaN();
    expect(inRange(Infinity)).toBe(10);
    expect(inRange(-Infinity)).toBe(0);
  });

  it('returns independent predicates per range', () => {
    const small = createInRange(0, 1);
    const large = createInRange(0, 100);

    expect(small(50)).toBe(1);
    expect(large(50)).toBe(50);
  });
});
