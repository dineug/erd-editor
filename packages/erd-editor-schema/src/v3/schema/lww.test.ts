import { describe, expect, it, vi } from 'vitest';

import { addOperator, removeOperator, replaceOperator } from '@/query/lww';
import * as lwwModule from '@/v3/schema/lww';
import { LWW, LWWTuple } from '@/v3/schema/lww';

describe('v3/schema/lww', () => {
  it('is a type-only module with no runtime exports', () => {
    expect(Object.keys(lwwModule)).toEqual([]);
  });

  it('describes a tuple of [tag, add, remove, Record<path, version>]', () => {
    const tuple: LWWTuple = ['table', 3, -1, { name: 2, comment: 5 }];
    const [tag, addVersion, removeVersion, paths] = tuple;

    expect(tuple).toHaveLength(4);
    expect(tag).toBe('table');
    expect(addVersion).toBe(3);
    expect(removeVersion).toBe(-1);
    expect(paths.comment).toBe(5);
    expect(paths.missing).toBeUndefined();
  });

  it('keys tuples by uuid inside the LWW record', () => {
    const lww: LWW = {
      'uuid-a': ['table', 1, -1, {}],
      'uuid-b': ['memo', 2, 3, { value: 4 }],
    };

    expect(Object.keys(lww)).toEqual(['uuid-a', 'uuid-b']);
    expect(lww['uuid-b'][0]).toBe('memo');
    expect(lww['uuid-c']).toBeUndefined();
  });

  it('is created by addOperator as [tag, version, -1, {}]', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    addOperator(lww, 5, 'uuid-a', 'table', recipe);

    expect(lww['uuid-a']).toEqual(['table', 5, -1, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('keeps the highest add version and ignores stale adds', () => {
    const lww: LWW = {};
    addOperator(lww, 5, 'uuid-a', 'table', () => {});
    addOperator(lww, 2, 'uuid-a', 'table', () => {});

    expect(lww['uuid-a'][1]).toBe(5);
  });

  it('records the remove version in slot 2 without clearing the add slot', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    addOperator(lww, 1, 'uuid-a', 'table', () => {});
    removeOperator(lww, 4, 'uuid-a', 'table', recipe);

    expect(lww['uuid-a']).toEqual(['table', 1, 4, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('skips the add recipe when the remove version is newer', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    removeOperator(lww, 7, 'uuid-a', 'table', () => {});
    addOperator(lww, 3, 'uuid-a', 'table', recipe);

    expect(lww['uuid-a']).toEqual(['table', 3, 7, {}]);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('tracks a version per path in slot 3', () => {
    const lww: LWW = {};

    replaceOperator(lww, 1, 'uuid-a', 'table', 'name', () => {});
    replaceOperator(lww, 4, 'uuid-a', 'table', 'comment', () => {});

    expect(lww['uuid-a'][3]).toEqual({ name: 1, comment: 4 });
  });

  it('ignores a replace whose version is older than the stored path version', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    replaceOperator(lww, 6, 'uuid-a', 'table', 'name', () => {});
    replaceOperator(lww, 2, 'uuid-a', 'table', 'name', recipe);

    expect(lww['uuid-a'][3].name).toBe(6);
    expect(recipe).not.toHaveBeenCalled();
  });
});
