import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, StartRelationshipType } from '@/constants/schema';
import type { RootState } from '@/engine/state';
import type { Collections, Column, Relationship } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';

/**
 * The columns a relationship ends on that are still in the document: its end
 * table is in the document and holds them. A removed table keeps its entity,
 * and the columns it held with it.
 */
function selectEndColumns(
  collections: Collections,
  hasTable: (id: string) => boolean,
  { end }: Relationship
): Column[] {
  if (!hasTable(end.tableId)) return [];

  const table = query(collections)
    .collection('tableEntities')
    .selectById(end.tableId);
  if (!table) return [];

  const has = arrayHas(table.columnIds);
  return query(collections)
    .collection('tableColumnEntities')
    .selectByIds(end.columnIds)
    .filter(column => has(column.id));
}

/**
 * Each relationship entity with the columns it still ends on. A removed one
 * ends on none, so the flags a file saves for it never hang on arrival order.
 */
function* endColumnsOf({ doc, collections }: RootState) {
  const hasTable = arrayHas(doc.tableIds);
  const hasRelationship = arrayHas(doc.relationshipIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectAll();

  for (const relationship of relationships) {
    yield [
      relationship,
      hasRelationship(relationship.id)
        ? selectEndColumns(collections, hasTable, relationship)
        : [],
    ] as const;
  }
}

/**
 * Marks each relationship identifying when every column it ends on is a primary
 * key, and not identifying, as a new one starts, once none of them is left or
 * it is removed, so the value follows the document whatever order actions arrive in.
 */
export function recalculateIdentification(state: RootState) {
  for (const [relationship, columns] of endColumnsOf(state)) {
    const value =
      columns.length !== 0 &&
      columns.every(column => bHas(column.options, ColumnOption.primaryKey));

    if (value !== relationship.identification) {
      relationship.identification = value;
    }
  }
}

/**
 * Starts each relationship dashed when every column it ends on is not null and
 * ringed otherwise, read off the columns as the identification is; one with no
 * end column left is dashed, as a new one starts.
 */
export function recalculateStartRelationshipType(state: RootState) {
  for (const [relationship, columns] of endColumnsOf(state)) {
    const value = columns.every(column =>
      bHas(column.options, ColumnOption.notNull)
    )
      ? StartRelationshipType.dash
      : StartRelationshipType.ring;

    if (value !== relationship.startRelationshipType) {
      relationship.startRelationshipType = value;
    }
  }
}
