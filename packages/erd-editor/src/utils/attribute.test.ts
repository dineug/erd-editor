import { describe, expect, it } from 'vite-plus/test';

import { restAttrs } from '@/utils/attribute';

describe('restAttrs', () => {
  it('keeps only entries that are neither nill nor an empty string', () => {
    expect(
      restAttrs({
        title: 'hello',
        placeholder: '',
        value: null,
        name: undefined,
        count: 0,
        disabled: false,
      })
    ).toEqual({ title: 'hello', count: 0, disabled: false });
  });

  it('returns an empty object when every value is filtered out', () => {
    expect(restAttrs({ a: null, b: undefined, c: '' })).toEqual({});
  });

  it('returns an empty object for an empty input', () => {
    expect(restAttrs({})).toEqual({});
  });

  it('does not mutate the source object', () => {
    const source = { a: 1, b: '' };
    const result = restAttrs(source);

    expect(source).toEqual({ a: 1, b: '' });
    expect(result).not.toBe(source);
  });

  it('keeps falsy-but-meaningful values such as 0, false and NaN', () => {
    const result = restAttrs({ zero: 0, no: false, nan: NaN });

    expect(Object.keys(result).sort()).toEqual(['nan', 'no', 'zero']);
    expect(result.zero).toBe(0);
    expect(result.no).toBe(false);
    expect(Number.isNaN(result.nan)).toBe(true);
  });

  it('reads only own enumerable keys', () => {
    const proto = { inherited: 'nope' };
    const source = Object.create(proto);
    source.own = 'yes';

    expect(restAttrs(source)).toEqual({ own: 'yes' });
  });
});
