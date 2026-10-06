import { describe, expect, it } from 'vite-plus/test';

import {
  getUsedColumnIds,
  isNormalMapping,
  MappingRow,
  repeatedIds,
  sameMembers,
  samePairs,
  sameSet,
  toPickedColumnIds,
} from '@/utils/map-columns/mapping';

describe('sameSet and sameMembers', () => {
  it('compares ids whatever their order, sameSet also whatever repeats', () => {
    expect(sameSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSet(['a', 'a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSet(['a'], ['a', 'b'])).toBe(false);

    expect(sameMembers(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameMembers(['a', 'a', 'b'], ['b', 'a', 'b'])).toBe(false);
    expect(sameMembers(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});

describe('repeatedIds', () => {
  it('lists each id a list holds more than once', () => {
    expect(repeatedIds(['a', 'b', 'a', 'c', 'b', 'a'])).toEqual(
      new Set(['a', 'b'])
    );
    expect(repeatedIds([])).toEqual(new Set());
  });
});

describe('isNormalMapping', () => {
  it('takes lists of one length that repeat nothing', () => {
    expect(isNormalMapping({ start: ['a', 'b'], end: ['x', 'y'] })).toBe(true);
    expect(isNormalMapping({ start: [], end: [] })).toBe(true);
    expect(isNormalMapping({ start: ['a', 'b'], end: ['x'] })).toBe(false);
    expect(isNormalMapping({ start: ['a', 'a'], end: ['x', 'y'] })).toBe(false);
    expect(isNormalMapping({ start: ['a', 'b'], end: ['x', 'x'] })).toBe(false);
  });
});

describe('samePairs', () => {
  it('compares the pairs two mappings make, not the order they list them in', () => {
    expect(
      samePairs(
        { start: ['a', 'b'], end: ['x', 'y'] },
        { start: ['b', 'a'], end: ['y', 'x'] }
      )
    ).toBe(true);
    expect(
      samePairs(
        { start: ['a', 'b'], end: ['x', 'y'] },
        { start: ['a', 'b'], end: ['y', 'x'] }
      )
    ).toBe(false);
  });

  it('pairs no place past the shorter list', () => {
    expect(
      samePairs({ start: ['a', 'b'], end: ['x'] }, { start: ['a'], end: ['x'] })
    ).toBe(true);
  });
});

describe('the child columns rows hold', () => {
  const rows: MappingRow[] = [
    { parentColumnId: 'a', pick: { kind: 'existing', columnId: 'x' } },
    { parentColumnId: 'b', pick: { kind: 'new' } },
    { parentColumnId: 'c', pick: null },
    { parentColumnId: 'd', pick: { kind: 'existing', columnId: 'y' } },
  ];

  it('lists the existing columns picked, in row order', () => {
    expect(toPickedColumnIds(rows)).toEqual(['x', 'y']);
  });

  it('names the columns the other rows hold, which a row shows in use', () => {
    expect(getUsedColumnIds(rows, 0)).toEqual(new Set(['y']));
    expect(getUsedColumnIds(rows, 2)).toEqual(new Set(['x', 'y']));
  });
});
