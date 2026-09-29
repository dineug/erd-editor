import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
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
