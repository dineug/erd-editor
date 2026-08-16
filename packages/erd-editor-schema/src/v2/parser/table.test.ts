import { describe, expect, it } from 'vite-plus/test';

import { createAndMergeTableEntity } from '@/v2/parser/table';

const defaultTableUI = {
  active: false,
  left: 200,
  top: 100,
  zIndex: 2,
  widthName: 60,
  widthComment: 60,
};

const defaultColumn = {
  id: '',
  name: '',
  comment: '',
  dataType: '',
  default: '',
  option: {
    autoIncrement: false,
    primaryKey: false,
    unique: false,
    notNull: false,
  },
  ui: {
    active: false,
    pk: false,
    fk: false,
    pfk: false,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
};

describe('createAndMergeTableEntity', () => {
  it('returns an empty entity when json is nill', () => {
    expect(createAndMergeTableEntity()).toEqual({ tables: [], indexes: [] });
    expect(createAndMergeTableEntity(null as any)).toEqual({
      tables: [],
      indexes: [],
    });
  });

  it('returns an empty entity when tables and indexes are not arrays', () => {
    expect(
      createAndMergeTableEntity({ tables: 'x', indexes: 1 } as any)
    ).toEqual({ tables: [], indexes: [] });
    expect(createAndMergeTableEntity({} as any)).toEqual({
      tables: [],
      indexes: [],
    });
  });

  it('fills table defaults for an empty table object', () => {
    const result = createAndMergeTableEntity({ tables: [{}] } as any);

    expect(result.tables[0]).toEqual({
      id: '',
      name: '',
      comment: '',
      columns: [],
      ui: { ...defaultTableUI },
      visible: true,
    });
  });

  it('merges every valid table field', () => {
    const result = createAndMergeTableEntity({
      tables: [
        {
          id: 'table-1',
          name: 'users',
          comment: 'user table',
          visible: false,
          ui: {
            active: true,
            color: '#123456',
            left: 1,
            top: 2,
            zIndex: 3,
            widthName: 100,
            widthComment: 120,
          },
        },
      ],
    });

    expect(result.tables[0]).toEqual({
      id: 'table-1',
      name: 'users',
      comment: 'user table',
      columns: [],
      visible: false,
      ui: {
        active: true,
        color: '#123456',
        left: 1,
        top: 2,
        zIndex: 3,
        widthName: 100,
        widthComment: 120,
      },
    });
  });

  it('ignores table fields with the wrong type', () => {
    const result = createAndMergeTableEntity({
      tables: [
        {
          id: 1,
          name: null,
          comment: [],
          visible: 'false',
          ui: {
            active: 1,
            color: 0,
            left: '1',
            top: null,
            zIndex: false,
            widthName: {},
            widthComment: undefined,
          },
        },
      ],
    } as any);

    expect(result.tables[0]).toEqual({
      id: '',
      name: '',
      comment: '',
      columns: [],
      ui: { ...defaultTableUI },
      visible: true,
    });
  });

  it('keeps an empty column list when columns is not an array', () => {
    const result = createAndMergeTableEntity({
      tables: [{ columns: 'nope' }],
    } as any);

    expect(result.tables[0].columns).toEqual([]);
  });

  it('fills column defaults for an empty column object', () => {
    const result = createAndMergeTableEntity({
      tables: [{ columns: [{}] }],
    } as any);

    expect(result.tables[0].columns[0]).toEqual(defaultColumn);
  });

  it('merges every valid column field', () => {
    const result = createAndMergeTableEntity({
      tables: [
        {
          columns: [
            {
              id: 'col-1',
              name: 'id',
              comment: 'pk',
              dataType: 'int',
              default: '0',
              option: {
                autoIncrement: true,
                primaryKey: true,
                unique: true,
                notNull: true,
              },
              ui: {
                active: true,
                pk: true,
                fk: true,
                pfk: true,
                widthName: 10,
                widthComment: 20,
                widthDataType: 30,
                widthDefault: 40,
              },
            },
          ],
        },
      ],
    });

    expect(result.tables[0].columns[0]).toEqual({
      id: 'col-1',
      name: 'id',
      comment: 'pk',
      dataType: 'int',
      default: '0',
      option: {
        autoIncrement: true,
        primaryKey: true,
        unique: true,
        notNull: true,
      },
      ui: {
        active: true,
        pk: true,
        fk: true,
        pfk: true,
        widthName: 10,
        widthComment: 20,
        widthDataType: 30,
        widthDefault: 40,
      },
    });
  });

  it('ignores column fields with the wrong type', () => {
    const result = createAndMergeTableEntity({
      tables: [
        {
          columns: [
            {
              id: 1,
              name: true,
              comment: {},
              dataType: [],
              default: 0,
              option: { autoIncrement: 'yes', primaryKey: 1 },
              ui: { active: 'no', pk: 1, widthName: '10' },
            },
          ],
        },
      ],
    } as any);

    expect(result.tables[0].columns[0]).toEqual(defaultColumn);
  });

  it('parses several tables and columns independently', () => {
    const result = createAndMergeTableEntity({
      tables: [
        { id: 'a', columns: [{ id: 'a1' }, { id: 'a2' }] },
        { id: 'b', columns: [] },
      ],
    } as any);

    expect(result.tables.map(table => table.id)).toEqual(['a', 'b']);
    expect(result.tables[0].columns.map(column => column.id)).toEqual([
      'a1',
      'a2',
    ]);
    expect(result.tables[1].columns).toEqual([]);
  });

  it('fills index defaults for an empty index object', () => {
    const result = createAndMergeTableEntity({ indexes: [{}] } as any);

    expect(result.indexes[0]).toEqual({
      id: '',
      name: '',
      tableId: '',
      columns: [],
      unique: false,
    });
  });

  it('merges every valid index field', () => {
    const result = createAndMergeTableEntity({
      indexes: [
        {
          id: 'index-1',
          name: 'idx_users_name',
          tableId: 'table-1',
          unique: true,
          columns: [
            { id: 'col-1', orderType: 'DESC' },
            { id: 'col-2', orderType: 'ASC' },
          ],
        },
      ],
    });

    expect(result.indexes[0]).toEqual({
      id: 'index-1',
      name: 'idx_users_name',
      tableId: 'table-1',
      unique: true,
      columns: [
        { id: 'col-1', orderType: 'DESC' },
        { id: 'col-2', orderType: 'ASC' },
      ],
    });
  });

  it('ignores index fields with the wrong type and unknown orderType', () => {
    const result = createAndMergeTableEntity({
      indexes: [
        {
          id: 0,
          name: null,
          tableId: [],
          unique: 'true',
          columns: [{ id: 3, orderType: 'RANDOM' }],
        },
      ],
    } as any);

    expect(result.indexes[0]).toEqual({
      id: '',
      name: '',
      tableId: '',
      unique: false,
      columns: [{ id: '', orderType: 'ASC' }],
    });
  });

  it('keeps an empty index column list when columns is not an array', () => {
    const result = createAndMergeTableEntity({
      indexes: [{ id: 'i', columns: 'nope' }],
    } as any);

    expect(result.indexes[0].columns).toEqual([]);
  });

  it('parses tables and indexes together', () => {
    const result = createAndMergeTableEntity({
      tables: [{ id: 't1' }],
      indexes: [{ id: 'i1', tableId: 't1' }],
    } as any);

    expect(result.tables).toHaveLength(1);
    expect(result.indexes).toHaveLength(1);
  });
});
