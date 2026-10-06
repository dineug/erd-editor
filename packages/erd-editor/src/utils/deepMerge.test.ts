import { describe, expect, it } from 'vite-plus/test';

import { deepMerge } from '@/utils/deepMerge';

/** The cases below merge shapes no entity type describes, so the spec calls it untyped. */
const merge = deepMerge as (target: unknown, source: unknown) => any;

describe('deepMerge', () => {
  it('adds the source keys a target lacks without touching the target', () => {
    const target = {};

    const result = merge(target, { key1: 'value1', key2: 'value2' });

    expect(target).toEqual({});
    expect(result).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('overwrites the simple keys both hold and keeps the rest', () => {
    const target = { key1: 'value1', key3: 'value3' };

    const result = merge(target, { key1: 'changed', key2: 'value2' });

    expect(target).toEqual({ key1: 'value1', key3: 'value3' });
    expect(result).toEqual({ key1: 'changed', key2: 'value2', key3: 'value3' });
  });

  it('keeps the target key order and appends the keys only the source has', () => {
    const result = merge({ b: 1, a: 2 }, { c: 3, a: 4 });

    expect(Object.keys(result)).toEqual(['b', 'a', 'c']);
  });

  it('merges nested objects key by key', () => {
    const target = { key1: { subkey1: 'value1', subkey2: 'value2' } };

    const result = merge(target, {
      key1: { subkey1: 'changed', subkey3: 'added' },
    });

    expect(target).toEqual({ key1: { subkey1: 'value1', subkey2: 'value2' } });
    expect(result).toEqual({
      key1: { subkey1: 'changed', subkey2: 'value2', subkey3: 'added' },
    });
  });

  it('replaces a simple value with a nested object', () => {
    const result = merge(
      { key1: 'value1', key2: 'value2' },
      { key1: { subkey1: 'subvalue1', subkey2: 'subvalue2' } }
    );

    expect(result).toEqual({
      key1: { subkey1: 'subvalue1', subkey2: 'subvalue2' },
      key2: 'value2',
    });
  });

  it('replaces a nested object with a simple value', () => {
    const result = merge(
      { key1: { subkey1: 'subvalue1', subkey2: 'subvalue2' }, key2: 'value2' },
      { key1: 'value1' }
    );

    expect(result).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('adds a nested object the target lacks', () => {
    expect(merge({ a: {} }, { b: { c: {} } })).toEqual({ a: {}, b: { c: {} } });
  });

  it('copies every object of target and source', () => {
    const target = { a: { d: 'bar' } };
    const source = { b: { c: 'foo' } };

    const result = merge(target, source);

    expect(result).toEqual({ a: { d: 'bar' }, b: { c: 'foo' } });
    expect(result.a).not.toBe(target.a);
    expect(result.b).not.toBe(source.b);
  });

  it('lets a copy of an array replace an object and of an object replace an array', () => {
    const arraySource = { key1: [{ subkey: 'one' }] };
    const objectSource = { key1: { subkey: { k: 'one' } } };

    const arrayResult = merge({ key1: { subkey: 'one' } }, arraySource);
    const objectResult = merge({ key1: ['subkey'] }, objectSource);

    expect(arrayResult).toEqual({ key1: [{ subkey: 'one' }] });
    expect(arrayResult.key1).not.toBe(arraySource.key1);
    expect(arrayResult.key1[0]).not.toBe(arraySource.key1[0]);
    expect(objectResult).toEqual({ key1: { subkey: { k: 'one' } } });
    expect(objectResult.key1).not.toBe(objectSource.key1);
    expect(objectResult.key1.subkey).not.toBe(objectSource.key1.subkey);
  });

  it('lets a copy of an array replace null', () => {
    const source = { key1: [{ subkey: 'one' }] };

    const result = merge({ key1: null }, source);

    expect(result).toEqual({ key1: [{ subkey: 'one' }] });
    expect(result.key1).not.toBe(source.key1);
    expect(result.key1[0]).not.toBe(source.key1[0]);
  });

  it('concatenates arrays, target first', () => {
    const target = ['a1', 'a2', 'c1', 'f1', 'p1'];

    const result = merge(target, ['t1', 's1', 'c2', 'r1', 'p2', 'p3']);

    expect(target).toEqual(['a1', 'a2', 'c1', 'f1', 'p1']);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([
      'a1',
      'a2',
      'c1',
      'f1',
      'p1',
      't1',
      's1',
      'c2',
      'r1',
      'p2',
      'p3',
    ]);
    expect(merge(['one', 'two'], ['one', 'three'])).toEqual([
      'one',
      'two',
      'one',
      'three',
    ]);
  });

  it('concatenates array properties into fresh arrays', () => {
    const target = { key1: ['one', 'two'] };
    const source = { key1: ['one', 'three'], key2: ['four'] };

    const result = merge(target, source);

    expect(result).toEqual({
      key1: ['one', 'two', 'one', 'three'],
      key2: ['four'],
    });
    expect(result.key1).not.toBe(target.key1);
    expect(result.key1).not.toBe(source.key1);
    expect(result.key2).not.toBe(source.key2);
  });

  it('copies the objects inside concatenated arrays', () => {
    const target = [{ key1: ['one', 'two'] }, { key3: ['four'] }];
    const source = [
      { key1: ['one', 'three'], key2: ['one'] },
      { key3: ['five'] },
    ];

    const result = merge(target, source);

    expect(result).toEqual([
      { key1: ['one', 'two'] },
      { key3: ['four'] },
      { key1: ['one', 'three'], key2: ['one'] },
      { key3: ['five'] },
    ]);
    expect(result[0].key1).not.toBe(target[0].key1);
    expect(result[1].key3).not.toBe(target[1].key3);
    expect(result[2].key1).not.toBe(source[0].key1);
    expect(result[2].key2).not.toBe(source[0].key2);
    expect(result[3].key3).not.toBe(source[1].key3);
  });

  it('keeps a null inside an array', () => {
    expect(merge([], [null])).toEqual([null]);
  });

  it('copies an array element and an array the target lacks', () => {
    const element = { key: 'yup' };
    const nested = {};

    const fromArray = merge([], [element]);
    const fromObject = merge({}, { ary: [nested] });

    expect(fromArray[0]).not.toBe(element);
    expect(fromArray[0]).toEqual({ key: 'yup' });
    expect(fromObject).toEqual({ ary: [{}] });
    expect(fromObject.ary[0]).not.toBe(nested);
  });

  it('overwrites a value with a key the source holds as undefined', () => {
    for (const value of [[], null, 2]) {
      const result = merge({ value }, { value: undefined });

      expect(Object.hasOwn(result, 'value')).toBe(true);
      expect(result.value).toBeUndefined();
    }
  });

  it('merges objects with a null prototype into a plain object', () => {
    const target = Object.create(null);
    const source = Object.create(null);
    target.wheels = 4;
    target.trunk = { toolbox: ['hammer'] };
    source.trunk = { toolbox: ['wrench'] };
    source.engine = 'v8';

    const result = merge(target, source);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).toEqual({
      wheels: 4,
      engine: 'v8',
      trunk: { toolbox: ['hammer', 'wrench'] },
    });
  });

  it('leaves out what the target inherits and keeps its own keys', () => {
    const target = Object.create({ parentKey: 'should be undefined' });
    target.plainKey = 'should be replaced';

    const result = merge(target, {
      parentKey: 'foo',
      plainKey: 'bar',
      newKey: 'baz',
    });

    expect(result.parentKey).toBeUndefined();
    expect(result.plainKey).toBe('bar');
    expect(result.newKey).toBe('baz');
  });

  it('leaves out a key the target holds as non-enumerable', () => {
    const target = { a: 1 };
    Object.defineProperty(target, 'hidden', { value: 1, enumerable: false });

    const result = merge(target, { hidden: 2, a: 3 });

    expect(result).toEqual({ a: 3 });
    expect(Object.hasOwn(result, 'hidden')).toBe(false);
  });

  describe('a parsed __proto__ key', () => {
    it('never reaches the prototype of the result', () => {
      const result = merge(
        {},
        JSON.parse('{ "__proto__": { "admin": true } }')
      );

      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(result.admin).toBeUndefined();
      expect(Object.keys(result)).toEqual([]);
      expect(({} as Record<string, unknown>).admin).toBeUndefined();
    });

    it('is dropped under a key the target holds, a key it lacks and in an array', () => {
      const result = merge(
        { ui: { x: 1 }, ids: [] },
        JSON.parse(
          '{"ui": {"__proto__": {"admin": true}, "x": 2}, "extra": {"__proto__": {"admin": true}}, "ids": [{"__proto__": {"admin": true}, "k": 1}]}'
        )
      );

      expect(result).toEqual({ ui: { x: 2 }, ids: [{ k: 1 }], extra: {} });
      expect(Object.getPrototypeOf(result.ui)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(result.extra)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(result.ids[0])).toBe(Object.prototype);
      expect(result.ui.admin).toBeUndefined();
      expect(result.extra.admin).toBeUndefined();
      expect(result.ids[0].admin).toBeUndefined();
      expect(({} as Record<string, unknown>).admin).toBeUndefined();
    });

    it('drops a key every object inherits, such as constructor', () => {
      const result = merge(
        { name: '' },
        JSON.parse(
          '{"constructor": {"prototype": {"admin": true}}, "toString": "x", "name": "a"}'
        )
      );

      expect(Object.keys(result)).toEqual(['name']);
      expect(result.name).toBe('a');
      expect(result.toString).toBe(Object.prototype.toString);
    });
  });
});
