import { describe, expect, it } from 'vite-plus/test';

import { ColumnType, NameViewMode, Show } from '@/constants/schema';
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
      columnLogicalName: 'columnLogicalName',
      columnDomain: 'columnDomain',
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

const PHYSICAL = NameViewMode.physical;

describe('getShowColumnOrder', () => {
  it('always keeps columnName even when nothing is shown', () => {
    expect(getShowColumnOrder(0, DEFAULT_COLUMN_ORDER, PHYSICAL)).toEqual([
      ColumnType.columnName,
    ]);
  });

  it('keeps every column type when all show flags are on', () => {
    expect(
      getShowColumnOrder(ALL_SHOW, DEFAULT_COLUMN_ORDER, PHYSICAL)
    ).toEqual(DEFAULT_COLUMN_ORDER);
  });

  it('preserves the order given by columnOrder rather than the flag order', () => {
    const reversed = [...DEFAULT_COLUMN_ORDER].reverse();

    expect(getShowColumnOrder(ALL_SHOW, reversed, PHYSICAL)).toEqual(reversed);
  });

  it('filters out column types whose show flag is off', () => {
    const show = Show.columnDataType | Show.columnComment;

    expect(getShowColumnOrder(show, DEFAULT_COLUMN_ORDER, PHYSICAL)).toEqual([
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
    expect(getShowColumnOrder(showFlag, [columnType], PHYSICAL)).toEqual([
      columnType,
    ]);
    expect(getShowColumnOrder(0, [columnType], PHYSICAL)).toEqual([]);
  });

  it('drops column types that are not part of ColumnType', () => {
    expect(getShowColumnOrder(ALL_SHOW, [0, 512, -1], PHYSICAL)).toEqual([]);
  });

  it('gates the domain behind its show flag in every name view', () => {
    for (const mode of [PHYSICAL, NameViewMode.logical, NameViewMode.both]) {
      expect(
        getShowColumnOrder(Show.columnDomain, [ColumnType.columnDomain], mode)
      ).toEqual([ColumnType.columnDomain]);
      expect(getShowColumnOrder(0, [ColumnType.columnDomain], mode)).toEqual(
        []
      );
    }
  });

  it('lays the cells out as each name view draws a row', () => {
    const order = [
      ColumnType.columnLogicalName,
      ColumnType.columnName,
      ColumnType.columnDataType,
      ColumnType.columnDomain,
    ];
    const show = Show.columnDataType | Show.columnDomain;

    expect(getShowColumnOrder(show, order, PHYSICAL)).toEqual([
      ColumnType.columnName,
      ColumnType.columnDataType,
      ColumnType.columnDomain,
    ]);
    // The logical view's name cell holds the logical name.
    expect(getShowColumnOrder(show, order, NameViewMode.logical)).toEqual([
      ColumnType.columnLogicalName,
      ColumnType.columnDataType,
      ColumnType.columnDomain,
    ]);
    expect(getShowColumnOrder(show, order, NameViewMode.both)).toEqual(order);
  });

  it('returns an empty array for an empty columnOrder', () => {
    expect(getShowColumnOrder(ALL_SHOW, [], PHYSICAL)).toEqual([]);
  });

  it('does not mutate the given columnOrder', () => {
    const columnOrder = [...DEFAULT_COLUMN_ORDER];

    getShowColumnOrder(0, columnOrder, PHYSICAL);

    expect(columnOrder).toEqual(DEFAULT_COLUMN_ORDER);
  });
});
