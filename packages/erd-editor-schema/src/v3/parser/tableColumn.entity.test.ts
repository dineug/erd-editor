import { describe, expect, it } from 'vite-plus/test';

import {
  createAndMergeTableColumnEntities,
  createColumn,
} from '@/v3/parser/tableColumn.entity';
import { ColumnOption, ColumnUIKey } from '@/v3/schema/tableColumn.entity';

describe('createColumn', () => {
  it('creates a column with the default ui', () => {
    const column = createColumn();

    expect(column).toMatchObject({
      id: '',
      tableId: '',
      name: '',
      comment: '',
      dataType: '',
      default: '',
      options: 0,
      ui: {
        keys: 0,
        widthName: 60,
        widthComment: 60,
        widthDataType: 60,
        widthDefault: 60,
      },
    });
    expect(column.meta.createAt).toBe(column.meta.updateAt);
  });
});

describe('createAndMergeTableColumnEntities', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['string', 'nope'],
    ['array', []],
  ])('returns an empty record for a non-object source (%s)', (_l, source) => {
    expect(createAndMergeTableColumnEntities(source as any)).toEqual({});
  });

  it('skips falsy entries and entries without an id', () => {
    expect(
      createAndMergeTableColumnEntities({
        a: undefined,
        b: { name: 'no-id' },
      })
    ).toEqual({});
  });

  it('merges every field', () => {
    const entities = createAndMergeTableColumnEntities({
      key: {
        id: 'c1',
        tableId: 't1',
        name: 'id',
        comment: 'pk',
        dataType: 'int',
        default: '0',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
        ui: {
          keys: ColumnUIKey.primaryKey,
          widthName: 70,
          widthComment: 71,
          widthDataType: 72,
          widthDefault: 73,
        },
        meta: { updateAt: 3, createAt: 4 },
      },
    });

    expect(entities.c1).toEqual({
      id: 'c1',
      tableId: 't1',
      name: 'id',
      comment: 'pk',
      dataType: 'int',
      default: '0',
      options: ColumnOption.primaryKey | ColumnOption.notNull,
      ui: {
        keys: ColumnUIKey.primaryKey,
        widthName: 70,
        widthComment: 71,
        widthDataType: 72,
        widthDefault: 73,
      },
      meta: { updateAt: 3, createAt: 4 },
    });
  });

  it('ignores wrongly typed values', () => {
    const entities = createAndMergeTableColumnEntities({
      key: {
        id: 'c1',
        tableId: 1 as any,
        dataType: null as any,
        options: '2' as any,
        ui: { keys: '1' as any, widthDefault: 99 },
      },
    });

    const column = entities.c1;
    expect(column.tableId).toBe('');
    expect(column.dataType).toBe('');
    expect(column.options).toBe(0);
    expect(column.ui.keys).toBe(0);
    expect(column.ui.widthDefault).toBe(99);
  });

  it('keeps the ui defaults when ui is missing', () => {
    const entities = createAndMergeTableColumnEntities({ key: { id: 'c1' } });

    expect(entities.c1.ui).toEqual({
      keys: 0,
      widthName: 60,
      widthComment: 60,
      widthDataType: 60,
      widthDefault: 60,
    });
  });

  it('merges several columns', () => {
    const entities = createAndMergeTableColumnEntities({
      a: { id: 'a', name: 'a' },
      b: { id: 'b', name: 'b' },
    });

    expect(Object.keys(entities).sort()).toEqual(['a', 'b']);
    expect(entities.b.name).toBe('b');
  });
});
