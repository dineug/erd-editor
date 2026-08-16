import { describe, expect, it } from 'vite-plus/test';

import {
  appendSelectColumns,
  appendSelectRangeColumns,
  selectRangeColumns,
} from '@/engine/modules/editor/utils/selectRangeColumn';

describe('appendSelectColumns', () => {
  it('appends the column id to the end of the list', () => {
    expect(appendSelectColumns(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps the list unique when the column is already selected', () => {
    expect(appendSelectColumns(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('drops pre-existing duplicates as a side effect of uniq', () => {
    expect(appendSelectColumns(['a', 'a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input list', () => {
    const columnIds = ['a'];
    const result = appendSelectColumns(columnIds, 'b');

    expect(columnIds).toEqual(['a']);
    expect(result).not.toBe(columnIds);
  });
});

describe('selectRangeColumns', () => {
  const columnIds = ['c1', 'c2', 'c3', 'c4'];

  it('returns only the target when there is no previous selection', () => {
    expect(selectRangeColumns(columnIds, null, 'c3')).toEqual(['c3']);
  });

  it('returns only the target when from and to are the same column', () => {
    expect(selectRangeColumns(columnIds, 'c3', 'c3')).toEqual(['c3']);
  });

  it('returns only the target when the from column is not in the table', () => {
    expect(selectRangeColumns(columnIds, 'unknown', 'c2')).toEqual(['c2']);
  });

  it('selects the inclusive forward range', () => {
    expect(selectRangeColumns(columnIds, 'c2', 'c4')).toEqual([
      'c2',
      'c3',
      'c4',
    ]);
  });

  it('selects the inclusive backward range in table order', () => {
    expect(selectRangeColumns(columnIds, 'c4', 'c2')).toEqual([
      'c2',
      'c3',
      'c4',
    ]);
  });

  it('selects two adjacent columns', () => {
    expect(selectRangeColumns(columnIds, 'c1', 'c2')).toEqual(['c1', 'c2']);
  });

  it('selects the whole table when the range spans both ends', () => {
    expect(selectRangeColumns(columnIds, 'c1', 'c4')).toEqual(columnIds);
  });

  it('yields an undefined slot when the target column is missing (actual behaviour)', () => {
    // toIndex is -1, so safeRange walks from -1 and columnIds[-1] is undefined.
    expect(selectRangeColumns(columnIds, 'c2', 'unknown')).toEqual([
      undefined,
      'c1',
      'c2',
    ]);
  });

  it('does not mutate the source column list', () => {
    const source = ['c1', 'c2'];
    selectRangeColumns(source, 'c1', 'c2');
    expect(source).toEqual(['c1', 'c2']);
  });
});

describe('appendSelectRangeColumns', () => {
  const columnIds = ['c1', 'c2', 'c3', 'c4'];

  it('merges the new range into the existing selection', () => {
    expect(appendSelectRangeColumns(columnIds, ['c1'], 'c3', 'c4')).toEqual([
      'c1',
      'c3',
      'c4',
    ]);
  });

  it('does not duplicate columns already selected', () => {
    expect(
      appendSelectRangeColumns(columnIds, ['c2', 'c3'], 'c2', 'c4')
    ).toEqual(['c2', 'c3', 'c4']);
  });

  it('appends only the target when there is no previous anchor', () => {
    expect(appendSelectRangeColumns(columnIds, ['c1'], null, 'c4')).toEqual([
      'c1',
      'c4',
    ]);
  });

  it('keeps the existing selection order first', () => {
    expect(appendSelectRangeColumns(columnIds, ['c4'], 'c1', 'c2')).toEqual([
      'c4',
      'c1',
      'c2',
    ]);
  });

  it('does not mutate the given selection', () => {
    const selectColumnIds = ['c1'];
    const result = appendSelectRangeColumns(
      columnIds,
      selectColumnIds,
      'c2',
      'c3'
    );

    expect(selectColumnIds).toEqual(['c1']);
    expect(result).toEqual(['c1', 'c2', 'c3']);
  });
});
