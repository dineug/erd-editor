import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { IndexEntities, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { splitsTableName, tableNamePart } from '@/utils/schema-sql/utils';

type KeyState = Pick<RootState, 'doc' | 'collections'>;

/**
 * Bumped by the two reducers that push an id onto the document's index list or
 * splice one out. An index never changes table, so those are the only writes
 * that regroup the list; replacing it or the entities is caught by identity.
 */
let indexListGeneration = 0;

export function invalidateTableIndexes() {
  indexListGeneration++;
}

type TableIndexes = {
  generation: number;
  entities: IndexEntities;
  byTable: Map<string, string[]>;
};

/** One grouping per index list, keyed on the list itself, so two stores never share one. */
const tableIndexesCache = new WeakMap<string[], TableIndexes>();

/**
 * The ids of the table's indexes in list order, from a grouping of the whole
 * list built once per add or drop, so measuring every table reads the list once
 * rather than once a table. An observer still re-runs on each add and drop.
 */
export function getTableIndexIds(
  { doc, collections }: KeyState,
  tableId: string
): string[] {
  const { indexIds } = doc;
  const entities = collections.indexEntities;
  // The length is the one read an observer keeps on the list: every push and
  // splice sets it, which is when the grouping is built again.
  if (!indexIds.length) return [];

  const cached = tableIndexesCache.get(indexIds);
  if (
    cached?.generation === indexListGeneration &&
    cached.entities === entities
  ) {
    return cached.byTable.get(tableId) ?? [];
  }

  const byTable = new Map<string, string[]>();
  for (const index of query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)) {
    const ids = byTable.get(index.tableId);
    if (ids) {
      ids.push(index.id);
    } else {
      byTable.set(index.tableId, [index.id]);
    }
  }

  tableIndexesCache.set(indexIds, {
    generation: indexListGeneration,
    entities,
    byTable,
  });
  return byTable.get(tableId) ?? [];
}

/**
 * A key the table's columns declare rather than an index entity: the primary
 * key over the columns marked PK, or one column marked UQ. The name is the one
 * the DDL gives it where a vendor writes a name.
 */
export type ColumnKey = {
  id: string;
  kind: 'primaryKey' | 'unique';
  name: string;
  columnIds: string[];
};

/** A unique index of the table and the columns of the table it keys, in key order. */
export type UniqueIndexKey = {
  indexId: string;
  columnIds: string[];
};

/** One alternate key: a unique index over two or more of the table's columns. */
export type AlternateKey = UniqueIndexKey;

/**
 * The keys a table's columns declare, primary key first and then each unique
 * column in column order. Only the columns edit them, so a list showing them
 * beside the index entities shows them read only.
 */
export function getColumnKeys(
  { collections, settings }: Pick<RootState, 'collections' | 'settings'>,
  table: Table
): ColumnKey[] {
  const tableName = splitsTableName(settings.database)
    ? tableNamePart(table.name, settings.bracketType)
    : table.name;
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const primaryKeyColumns = columns.filter(column =>
    bHas(column.options, ColumnOption.primaryKey)
  );
  const keys: ColumnKey[] = primaryKeyColumns.length
    ? [
        {
          id: `primaryKey:${table.id}`,
          kind: 'primaryKey',
          name: `PK_${tableName}`,
          columnIds: primaryKeyColumns.map(column => column.id),
        },
      ]
    : [];

  for (const column of columns) {
    if (!bHas(column.options, ColumnOption.unique)) continue;

    keys.push({
      id: `unique:${column.id}`,
      kind: 'unique',
      name: `UQ_${tableName}_${column.name}`,
      columnIds: [column.id],
    });
  }

  return keys;
}

/**
 * Each unique index of the table in index list order, with the columns of the
 * table it keys in key order: over two or more an alternate key, over one the
 * unique key of that column.
 */
export function getUniqueIndexKeys(
  state: KeyState,
  table: Table
): UniqueIndexKey[] {
  const tableColumnIds = new Set(table.columnIds);
  const indexColumns = query(state.collections).collection(
    'indexColumnEntities'
  );

  return query(state.collections)
    .collection('indexEntities')
    .selectByIds(getTableIndexIds(state, table.id))
    .filter(index => index.unique)
    .map(index => ({
      indexId: index.id,
      columnIds: indexColumns
        .selectByIds(index.indexColumnIds)
        .map(indexColumn => indexColumn.columnId)
        .filter(columnId => tableColumnIds.has(columnId)),
    }));
}

/**
 * The table's alternate keys, AK1 first: its unique indexes over two or more
 * of its columns, ordered by where those columns stand in the table. Neither
 * an undo nor a peer's concurrent add reorders them, as the index list would.
 */
export function getAlternateKeys(
  state: KeyState,
  table: Table
): AlternateKey[] {
  const positions = new Map(table.columnIds.map((id, index) => [id, index]));

  return getUniqueIndexKeys(state, table)
    .filter(key => key.columnIds.length > 1)
    .sort((a, b) => compareKeys(a, b, positions));
}

/**
 * Key by key column, by table position: the key whose first column stands
 * higher comes first, a key that is the other's prefix before it, and two keys
 * over the same columns by their ids.
 */
function compareKeys(
  a: AlternateKey,
  b: AlternateKey,
  positions: Map<string, number>
): number {
  const length = Math.min(a.columnIds.length, b.columnIds.length);

  for (let index = 0; index < length; index++) {
    const order =
      (positions.get(a.columnIds[index]) as number) -
      (positions.get(b.columnIds[index]) as number);
    if (order) return order;
  }

  if (a.columnIds.length !== b.columnIds.length) {
    return a.columnIds.length - b.columnIds.length;
  }

  // Two indexes never share an id, and a code unit order is the same on every
  // replica, which a locale's collation need not be.
  return a.indexId < b.indexId ? -1 : 1;
}

/**
 * What each column in those keys is marked with, AK1.2 for the second column
 * of the first key; a column in several keys carries each mark, comma joined.
 * A column in none has no entry.
 */
export function getAlternateKeyMarks(
  state: KeyState,
  table: Table
): Record<string, string> {
  const marks: Record<string, string[]> = {};

  getAlternateKeys(state, table).forEach((key, keyIndex) => {
    key.columnIds.forEach((columnId, columnIndex) => {
      (marks[columnId] ??= []).push(`AK${keyIndex + 1}.${columnIndex + 1}`);
    });
  });

  return Object.fromEntries(
    Object.entries(marks).map(([columnId, mark]) => [columnId, mark.join(',')])
  );
}
