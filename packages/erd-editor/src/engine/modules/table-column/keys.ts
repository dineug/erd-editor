import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import type { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

/**
 * Sets every column's primary key mark from its primary key option, the one
 * place the editor changes both, so a file that saves no mark shows the key.
 * The foreign key mark is left to validateForeignKeys.
 */
export function syncPrimaryKeys({ collections }: RootState) {
  for (const column of query(collections)
    .collection('tableColumnEntities')
    .selectAll()) {
    const value = bHas(column.options, ColumnOption.primaryKey);
    if (value === bHas(column.ui.keys, ColumnUIKey.primaryKey)) continue;

    column.ui.keys = value
      ? column.ui.keys | ColumnUIKey.primaryKey
      : column.ui.keys & ~ColumnUIKey.primaryKey;
  }
}

/**
 * Marks as a foreign key every column of a table in the document that a
 * relationship in the document ends on in that table, and clears every other
 * one, a removed column's too, so a file's bits never hang on arrival order.
 */
export function validateForeignKeys({ doc, collections }: RootState) {
  const endColumnIds = new Map<string, Set<string>>();
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds);

  for (const { end } of relationships) {
    const ids = endColumnIds.get(end.tableId) ?? new Set<string>();
    end.columnIds.forEach(id => ids.add(id));
    endColumnIds.set(end.tableId, ids);
  }

  const tableIdOf = new Map<string, string>();
  for (const table of query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)) {
    table.columnIds.forEach(id => tableIdOf.set(id, table.id));
  }

  for (const column of query(collections)
    .collection('tableColumnEntities')
    .selectAll()) {
    const tableId = tableIdOf.get(column.id);
    const value =
      tableId !== undefined &&
      (endColumnIds.get(tableId)?.has(column.id) ?? false);
    if (value === bHas(column.ui.keys, ColumnUIKey.foreignKey)) continue;

    column.ui.keys = value
      ? column.ui.keys | ColumnUIKey.foreignKey
      : column.ui.keys & ~ColumnUIKey.foreignKey;
  }
}
