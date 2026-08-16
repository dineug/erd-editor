import { describe, expect, it, vi } from 'vite-plus/test';

import { addOperator, removeOperator, replaceOperator } from '@/query/lww';
import { LWW } from '@/v3/schema/lww';

describe('addOperator', () => {
  it('creates a tuple for an unknown id and runs the recipe', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    addOperator(lww, 3, 'id-1', 'tableEntities', recipe);

    expect(lww['id-1']).toEqual(['tableEntities', 3, -1, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the version is not newer than the initial -1', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    addOperator(lww, -1, 'id-1', 'tableEntities', recipe);

    expect(lww['id-1']).toEqual(['tableEntities', -1, -1, {}]);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('keeps the highest add version', () => {
    const lww: LWW = { 'id-1': ['tableEntities', 5, -1, {}] };
    const recipe = vi.fn();

    addOperator(lww, 3, 'id-1', 'tableEntities', recipe);

    expect(lww['id-1'][1]).toBe(5);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('skips the recipe when a newer remove wins', () => {
    const lww: LWW = { 'id-1': ['tableEntities', -1, 10, {}] };
    const recipe = vi.fn();

    addOperator(lww, 4, 'id-1', 'tableEntities', recipe);

    expect(lww['id-1']).toEqual(['tableEntities', 4, 10, {}]);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('runs the recipe when the add version beats the remove version', () => {
    const lww: LWW = { 'id-1': ['tableEntities', 1, 2, {}] };
    const recipe = vi.fn();

    addOperator(lww, 3, 'id-1', 'tableEntities', recipe);

    expect(lww['id-1']).toEqual(['tableEntities', 3, 2, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing tuple and never rewrites its tag', () => {
    const lww: LWW = { 'id-1': ['memoEntities', 0, -1, { name: 1 }] };
    const recipe = vi.fn();

    addOperator(lww, 2, 'id-1', 'tableEntities', recipe);

    expect(lww['id-1'][0]).toBe('memoEntities');
    expect(lww['id-1'][1]).toBe(2);
    expect(lww['id-1'][3]).toEqual({ name: 1 });
    expect(recipe).toHaveBeenCalledTimes(1);
  });
});

describe('removeOperator', () => {
  it('creates a tuple for an unknown id and runs the recipe', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    removeOperator(lww, 0, 'id-1', 'memoEntities', recipe);

    expect(lww['id-1']).toEqual(['memoEntities', -1, 0, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('removes at the very same version as the add', () => {
    const lww: LWW = { 'id-1': ['memoEntities', 7, -1, {}] };
    const recipe = vi.fn();

    removeOperator(lww, 7, 'id-1', 'memoEntities', recipe);

    expect(lww['id-1']).toEqual(['memoEntities', 7, 7, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('records the remove version but skips the recipe when the add is newer', () => {
    const lww: LWW = { 'id-1': ['memoEntities', 9, -1, {}] };
    const recipe = vi.fn();

    removeOperator(lww, 5, 'id-1', 'memoEntities', recipe);

    expect(lww['id-1']).toEqual(['memoEntities', 9, 5, {}]);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('keeps the highest remove version', () => {
    const lww: LWW = { 'id-1': ['memoEntities', -1, 8, {}] };
    const recipe = vi.fn();

    removeOperator(lww, 2, 'id-1', 'memoEntities', recipe);

    expect(lww['id-1'][2]).toBe(8);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a version below the initial -1', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    removeOperator(lww, -2, 'id-1', 'memoEntities', recipe);

    expect(lww['id-1']).toEqual(['memoEntities', -1, -1, {}]);
    expect(recipe).not.toHaveBeenCalled();
  });
});

describe('replaceOperator', () => {
  it('creates a tuple and records the path version', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    replaceOperator(lww, 1, 'id-1', 'tableEntities', 'name', recipe);

    expect(lww['id-1']).toEqual(['tableEntities', -1, -1, { name: 1 }]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('tracks each path independently', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    replaceOperator(lww, 4, 'id-1', 'tableEntities', 'name', recipe);
    replaceOperator(lww, 2, 'id-1', 'tableEntities', 'comment', recipe);

    expect(lww['id-1'][3]).toEqual({ name: 4, comment: 2 });
    expect(recipe).toHaveBeenCalledTimes(2);
  });

  it('applies again on an equal version', () => {
    const lww: LWW = { 'id-1': ['tableEntities', -1, -1, { name: 3 }] };
    const recipe = vi.fn();

    replaceOperator(lww, 3, 'id-1', 'tableEntities', 'name', recipe);

    expect(lww['id-1'][3].name).toBe(3);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('ignores an older version', () => {
    const lww: LWW = { 'id-1': ['tableEntities', -1, -1, { name: 6 }] };
    const recipe = vi.fn();

    replaceOperator(lww, 5, 'id-1', 'tableEntities', 'name', recipe);

    expect(lww['id-1'][3].name).toBe(6);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('ignores a version below the implicit -1 default', () => {
    const lww: LWW = {};
    const recipe = vi.fn();

    replaceOperator(lww, -2, 'id-1', 'tableEntities', 'name', recipe);

    expect(lww['id-1']).toEqual(['tableEntities', -1, -1, {}]);
    expect(recipe).not.toHaveBeenCalled();
  });
});
