import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { getColumnKeys } from '@/utils/tableKeys';

type IndexSpec = {
  id: string;
  unique: boolean;
  columnIds: string[];
  tableId?: string;
};

/** A region table of five columns, id a to e, and the indexes given in order. */
function createState(
  options: Partial<Record<string, number>> = {},
  indexes: IndexSpec[] = []
) {
  const state = {
    ...schemaV3Parser({}),
    editor: {},
    lww: {},
  } as unknown as RootState;
  const columnIds = ['a', 'b', 'c', 'd', 'e'];

  state.collections.tableColumnEntities = Object.fromEntries(
    columnIds.map(id => [
      id,
      createColumn({
        id,
        tableId: 'region',
        name: `col_${id}`,
        options: options[id] ?? 0,
      }),
    ])
  );
  const table = createTable({ id: 'region', name: 'region', columnIds });
  state.collections.tableEntities = { region: table };
  state.doc.tableIds = ['region'];

  for (const { id, unique, columnIds, tableId = 'region' } of indexes) {
    const index = createIndex({ id, tableId, unique });

    columnIds.forEach(columnId => {
      const indexColumn = createIndexColumn({
        id: `${id}-${columnId}`,
        indexId: id,
        columnId,
      });
      index.indexColumnIds.push(indexColumn.id);
      state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
    });

    state.collections.indexEntities[id] = index;
    state.doc.indexIds.push(id);
  }

  return { state, table };
}

describe('getColumnKeys', () => {
  it('lists the primary key and then each unique column in column order', () => {
    const { state, table } = createState({
      a: ColumnOption.primaryKey,
      b: ColumnOption.primaryKey | ColumnOption.unique,
      d: ColumnOption.unique,
    });

    expect(getColumnKeys(state, table)).toEqual([
      {
        id: 'primaryKey:region',
        kind: 'primaryKey',
        name: 'PK_region',
        columnIds: ['a', 'b'],
      },
      {
        id: 'unique:b',
        kind: 'unique',
        name: 'UQ_region_col_b',
        columnIds: ['b'],
      },
      {
        id: 'unique:d',
        kind: 'unique',
        name: 'UQ_region_col_d',
        columnIds: ['d'],
      },
    ]);
  });

  it('lists nothing for a table whose columns declare no key', () => {
    const { state, table } = createState({ a: ColumnOption.notNull });

    expect(getColumnKeys(state, table)).toEqual([]);
  });
});
