import { describe, expect, it } from 'vite-plus/test';

import { ColumnType, Show } from '@/constants/schema';
import {
  CellType,
  getShowColumnOrder,
  hasCellType,
} from '@/utils/table-clipboard';

const ALL_SHOW =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnAutoIncrement |
  Show.columnPrimaryKey |
  Show.columnUnique |
  Show.columnNotNull |
  Show.relationship;

const DEFAULT_COLUMN_ORDER = [
  ColumnType.columnName,
  ColumnType.columnDataType,
  ColumnType.columnNotNull,
  ColumnType.columnUnique,
  ColumnType.columnAutoIncrement,
  ColumnType.columnDefault,
  ColumnType.columnComment,
];

describe('CellType', () => {
  it('maps every cell type to its own string literal', () => {
    expect(CellType).toEqual({
      columnName: 'columnName',
      columnDataType: 'columnDataType',
      columnNotNull: 'columnNotNull',
      columnUnique: 'columnUnique',
      columnAutoIncrement: 'columnAutoIncrement',
      columnDefault: 'columnDefault',
      columnComment: 'columnComment',
    });
  });
});

describe('hasCellType', () => {
  it('accepts every known cell type', () => {
    for (const value of Object.values(CellType)) {
      expect(hasCellType(value)).toBe(true);
    }
  });

  it('rejects the empty string and unknown values', () => {
    expect(hasCellType('')).toBe(false);
    expect(hasCellType('columnPrimaryKey')).toBe(false);
    expect(hasCellType('ColumnName')).toBe(false);
  });
});

describe('getShowColumnOrder', () => {
  it('always keeps columnName even when nothing is shown', () => {
    expect(getShowColumnOrder(0, DEFAULT_COLUMN_ORDER)).toEqual([
      ColumnType.columnName,
    ]);
  });

  it('keeps every column type when all show flags are on', () => {
    expect(getShowColumnOrder(ALL_SHOW, DEFAULT_COLUMN_ORDER)).toEqual(
      DEFAULT_COLUMN_ORDER
    );
  });

  it('preserves the order given by columnOrder rather than the flag order', () => {
    const reversed = [...DEFAULT_COLUMN_ORDER].reverse();

    expect(getShowColumnOrder(ALL_SHOW, reversed)).toEqual(reversed);
  });

  it('filters out column types whose show flag is off', () => {
    const show = Show.columnDataType | Show.columnComment;

    expect(getShowColumnOrder(show, DEFAULT_COLUMN_ORDER)).toEqual([
      ColumnType.columnName,
      ColumnType.columnDataType,
      ColumnType.columnComment,
    ]);
  });

  it.each([
    ['columnDataType', ColumnType.columnDataType, Show.columnDataType],
    ['columnDefault', ColumnType.columnDefault, Show.columnDefault],
    ['columnComment', ColumnType.columnComment, Show.columnComment],
    [
      'columnAutoIncrement',
      ColumnType.columnAutoIncrement,
      Show.columnAutoIncrement,
    ],
    ['columnUnique', ColumnType.columnUnique, Show.columnUnique],
    ['columnNotNull', ColumnType.columnNotNull, Show.columnNotNull],
  ])('gates %s behind its own show flag', (_name, columnType, showFlag) => {
    expect(getShowColumnOrder(showFlag, [columnType])).toEqual([columnType]);
    expect(getShowColumnOrder(0, [columnType])).toEqual([]);
  });

  it('drops column types that are not part of ColumnType', () => {
    expect(getShowColumnOrder(ALL_SHOW, [0, 128, -1])).toEqual([]);
  });

  it('returns an empty array for an empty columnOrder', () => {
    expect(getShowColumnOrder(ALL_SHOW, [])).toEqual([]);
  });

  it('does not mutate the given columnOrder', () => {
    const columnOrder = [...DEFAULT_COLUMN_ORDER];

    getShowColumnOrder(0, columnOrder);

    expect(columnOrder).toEqual(DEFAULT_COLUMN_ORDER);
  });
});
