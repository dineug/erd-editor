import { describe, expect, it } from 'vite-plus/test';

import { arrayHas } from '@/array.utils';

describe('arrayHas', () => {
  it('returns a predicate reporting membership', () => {
    const has = arrayHas(['a', 'b', 'c']);

    expect(has('a')).toBe(true);
    expect(has('c')).toBe(true);
    expect(has('d')).toBe(false);
  });

  it('always returns false for an empty source', () => {
    const has = arrayHas<number>([]);

    expect(has(0)).toBe(false);
    expect(has(1)).toBe(false);
  });

  it('uses SameValueZero equality, so NaN is found but distinct objects are not', () => {
    const target = { id: 1 };
    const has = arrayHas<unknown>([NaN, target, 0]);

    expect(has(NaN)).toBe(true);
    expect(has(target)).toBe(true);
    expect(has({ id: 1 })).toBe(false);
    expect(has(-0)).toBe(true);
    expect(has('0')).toBe(false);
  });

  it('snapshots the array at creation time', () => {
    const source = ['a'];
    const has = arrayHas(source);
    source.push('b');

    expect(has('a')).toBe(true);
    expect(has('b')).toBe(false);
  });

  it('accepts a readonly array', () => {
    const source = ['x', 'y'] as const;
    const has = arrayHas(source);

    expect(has('x')).toBe(true);
    expect(has('y')).toBe(true);
  });

  it('deduplicates repeated values without changing the result', () => {
    const has = arrayHas([1, 1, 2]);

    expect(has(1)).toBe(true);
    expect(has(2)).toBe(true);
    expect(has(3)).toBe(false);
  });
});
