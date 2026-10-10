import { isNumber, isString } from 'es-toolkit';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  assign,
  propOr,
  restoreSequence,
  validNumber,
  validString,
} from '@/helper';

type Target = {
  name: string;
  count: number;
};

describe('assign', () => {
  it('copies the value when the validator accepts it', () => {
    const target: Target = { name: 'a', count: 1 };
    const assignString = assign(isString, target, { name: 'b', count: 2 });

    assignString('name');

    expect(target).toEqual({ name: 'b', count: 1 });
  });

  it('leaves the target untouched when the validator rejects the value', () => {
    const target: Target = { name: 'a', count: 1 };
    const assignNumber = assign(isNumber, target, { name: 'b' } as any);

    assignNumber('count');

    expect(target).toEqual({ name: 'a', count: 1 });
  });

  it('does nothing when there is no source', () => {
    const target: Target = { name: 'a', count: 1 };
    const valid = vi.fn(() => true);

    assign(valid, target)('name');

    expect(valid).not.toHaveBeenCalled();
    expect(target).toEqual({ name: 'a', count: 1 });
  });

  it('assigns undefined when the validator accepts a missing key', () => {
    const target: Target = { name: 'a', count: 1 };

    assign(() => true, target, {})('name');

    expect(target.name).toBeUndefined();
  });
});

describe('validString', () => {
  const valid = validString(['ERD', 'settings']);

  it('accepts only strings contained in the list', () => {
    expect(valid('ERD')).toBe(true);
    expect(valid('settings')).toBe(true);
  });

  it('rejects strings outside the list and non-strings', () => {
    expect(valid('unknown')).toBe(false);
    expect(valid(1)).toBe(false);
    expect(valid(undefined)).toBe(false);
    expect(valid(null)).toBe(false);
  });
});

describe('validNumber', () => {
  const valid = validNumber([1, 2, 4]);

  it('accepts only numbers contained in the list', () => {
    expect(valid(1)).toBe(true);
    expect(valid(4)).toBe(true);
  });

  it('rejects numbers outside the list and non-numbers', () => {
    expect(valid(3)).toBe(false);
    expect(valid('1')).toBe(false);
    expect(valid(null)).toBe(false);
  });
});

describe('propOr', () => {
  it('returns the property when it exists', () => {
    expect(propOr({ a: 1 }, 'a', 99)).toBe(1);
  });

  it('returns the default when the property is missing', () => {
    expect(propOr({ a: 1 } as any, 'b', 99)).toBe(99);
  });

  it('returns the default for null and undefined values only', () => {
    expect(propOr({ a: null } as any, 'a', 99)).toBe(99);
    expect(propOr({ a: undefined } as any, 'a', 99)).toBe(99);
    expect(propOr({ a: 0 } as any, 'a', 99)).toBe(0);
    expect(propOr({ a: '' } as any, 'a', 'fallback')).toBe('');
    expect(propOr({ a: false } as any, 'a', true)).toBe(false);
  });
});

describe('restoreSequence', () => {
  it('keeps a sequence that holds every listed id, extra ids included', () => {
    const seqIds = ['a', 'z', 'b'];

    expect(restoreSequence(['b', 'a'], seqIds)).toBe(seqIds);
  });

  it('starts a sequence missing a listed id at a copy of the list', () => {
    const ids = ['b', 'a'];
    const restored = restoreSequence(ids, ['a']);

    expect(restored).toEqual(['b', 'a']);
    expect(restored).not.toBe(ids);
  });

  it('keeps an empty sequence beside an empty list', () => {
    expect(restoreSequence([], [])).toEqual([]);
  });
});
