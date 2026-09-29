import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';

type KeyState = Pick<RootState, 'doc' | 'collections'>;

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

/** One alternate key: a unique index of the table and the columns it keys, in key order. */
export type AlternateKey = {
  indexId: string;
  columnIds: string[];
};

/**
 * The keys a table's columns declare, primary key first and then each unique
 * column in column order. Only the columns edit them, so a list showing them
 * beside the index entities shows them read only.
 */
export function getColumnKeys(
  { collections }: KeyState,
  table: Table
): ColumnKey[] {
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
          name: `PK_${table.name}`,
          columnIds: primaryKeyColumns.map(column => column.id),
        },
      ]
    : [];

  for (const column of columns) {
    if (!bHas(column.options, ColumnOption.unique)) continue;

    keys.push({
      id: `unique:${column.id}`,
      kind: 'unique',
      name: `UQ_${table.name}_${column.name}`,
      columnIds: [column.id],
    });
  }

  return keys;
}

/**
 * The table's alternate keys, AK1 first: its unique indexes in document order,
 * one column or several, each with the columns of the table it keys in key
 * order. Counting single-column ones too keeps a number when a key gains a column.
 */
export function getAlternateKeys(
  { doc, collections }: KeyState,
  table: Table
): AlternateKey[] {
  const hasColumn = arrayHas(table.columnIds);
  const indexColumns = query(collections).collection('indexColumnEntities');

  return query(collections)
    .collection('indexEntities')
    .selectByIds(doc.indexIds)
    .filter(index => index.tableId === table.id && index.unique)
    .map(index => ({
      indexId: index.id,
      columnIds: indexColumns
        .selectByIds(index.indexColumnIds)
        .map(indexColumn => indexColumn.columnId)
        .filter(hasColumn),
    }))
    .filter(key => key.columnIds.length > 0);
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
