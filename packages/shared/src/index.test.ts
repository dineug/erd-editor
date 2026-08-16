import { describe, expect, it } from 'vite-plus/test';

import * as shared from '@/index';

describe('index barrel', () => {
  it('re-exports the array utilities', () => {
    expect(typeof shared.arrayHas).toBe('function');
    expect(shared.arrayHas([1, 2])(2)).toBe(true);
  });

  it('re-exports the function helpers', () => {
    expect(typeof shared.safeCallback).toBe('function');
    expect(shared.safeCallback(() => 'ok')).toBe('ok');
    expect(typeof shared.asap).toBe('function');
  });

  it('re-exports the type guards', () => {
    expect(shared.isString('a')).toBe(true);
    expect(shared.isNumber('a')).toBe(false);
    expect(shared.isObject({})).toBe(true);
    expect(shared.isNill(null)).toBe(true);
    expect(shared.nonNullable(undefined)).toBe(false);
  });

  it('re-exports nanoid', () => {
    expect(shared.nanoid()).toHaveLength(21);
  });

  it('re-exports the number utilities', () => {
    expect(shared.createInRange(0, 5)(9)).toBe(5);
  });

  it('exposes every public helper name exactly once', () => {
    const names = Object.keys(shared);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'arrayHas',
        'asap',
        'createInRange',
        'isArray',
        'isBigint',
        'isBoolean',
        'isFunction',
        'isGenerator',
        'isInteger',
        'isIterator',
        'isNill',
        'isNull',
        'isNumber',
        'isObject',
        'isObjectRaw',
        'isPrimitive',
        'isPromise',
        'isPromiseLike',
        'isString',
        'isSymbol',
        'isUndefined',
        'nanoid',
        'nonNullable',
        'safeCallback',
      ])
    );
  });
});
