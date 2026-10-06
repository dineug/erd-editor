import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { Relationship, Table } from '@/internal-types';

/** The child column a row maps its parent column to: one the child holds, or a new one. */
export type ColumnPick =
  | { kind: 'existing'; columnId: string }
  | { kind: 'new' };

/**
 * One pair of a mapping, a parent key column and the child column picked for
 * it, null until one is. A place of a stored mapping its lists cannot pair is
 * invalid, with no parent column where the start list ends before it.
 */
export type MappingRow = {
  parentColumnId: string | null;
  pick: ColumnPick | null;
  invalid?: boolean;
};

/**
 * What the Map Columns dialog confirms: the relationship to create between two
 * tables, or the one whose columns it changes, with the parent key it reads,
 * a key id of the parent's columns or the stored mapping kept as it is.
 */
export type MapColumnsDraft =
  | {
      mode: 'create';
      startTableId: string;
      endTableId: string;
      relationshipType: number;
      keyId: string | null;
      rows: MappingRow[];
    }
  | {
      mode: 'edit';
      relationshipId: string;
      keyId: string;
      rows: MappingRow[];
    };

/** A relationship's two column lists, end[i] referencing start[i]. */
export type ColumnMapping = { start: string[]; end: string[] };

/** The two column lists the relationship holds, as they stand. */
export const toColumnMapping = ({
  start,
  end,
}: Relationship): ColumnMapping => ({
  start: start.columnIds,
  end: end.columnIds,
});

/** The table, while the document holds it; a removed one stays an entity a while. */
export function getLiveTable(
  { doc, collections }: Pick<RootState, 'doc' | 'collections'>,
  tableId: string
): Table | undefined {
  if (!doc.tableIds.includes(tableId)) return undefined;
  return query(collections).collection('tableEntities').selectById(tableId);
}

/** The relationship, while the document holds it. */
export function getLiveRelationship(
  { doc, collections }: Pick<RootState, 'doc' | 'collections'>,
  relationshipId: string
): Relationship | undefined {
  if (!doc.relationshipIds.includes(relationshipId)) return undefined;
  return query(collections)
    .collection('relationshipEntities')
    .selectById(relationshipId);
}

/** Whether the column is one of the live table's, not one removed from it. */
export const isLiveColumn = (table: Table | undefined, columnId: string) =>
  !!table && table.columnIds.includes(columnId);

/** Two lists holding the same ids, however ordered or repeated. */
export function sameSet(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every(id => right.has(id));
}

/** Two lists holding the same ids once each, however ordered. */
export const sameMembers = (a: string[], b: string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  sameSet(a, b);

/** The ids a list holds more than once. */
export function repeatedIds(ids: string[]): Set<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return repeated;
}

/** Lists of one length that repeat no id, which pair by place into one key reference. */
export const isNormalMapping = ({ start, end }: ColumnMapping) =>
  start.length === end.length &&
  new Set(start).size === start.length &&
  new Set(end).size === end.length;

const toPairKeys = ({ start, end }: ColumnMapping) =>
  start
    .slice(0, Math.min(start.length, end.length))
    .map((id, index) => JSON.stringify([id, end[index]]));

/** Two mappings pairing the same columns, in whatever order they list the pairs. */
export const samePairs = (a: ColumnMapping, b: ColumnMapping) =>
  sameSet(toPairKeys(a), toPairKeys(b));

/** Whether the relationship's own lists are normal and pair what the mapping pairs. */
export function holdsPairs(
  relationship: Relationship,
  mapping: ColumnMapping
): boolean {
  const stored = toColumnMapping(relationship);
  return isNormalMapping(stored) && samePairs(stored, mapping);
}

/** The child column each picked row maps to, in row order. */
export const toPickedColumnIds = (rows: MappingRow[]) =>
  rows.flatMap(({ pick }) =>
    pick?.kind === 'existing' ? [pick.columnId] : []
  );

/** The child columns the other rows hold, which a row's own list shows in use. */
export const getUsedColumnIds = (rows: MappingRow[], rowIndex: number) =>
  new Set(toPickedColumnIds(rows.filter((_, index) => index !== rowIndex)));
