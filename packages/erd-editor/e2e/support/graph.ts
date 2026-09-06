import type { ErdDocument } from './schema';

/** The ids an array gained, in the order the document now holds them. */
export function addedIds(before: string[], after: string[]) {
  const had = new Set(before);
  return after.filter(id => !had.has(id));
}

/**
 * A relationship read back by the names it joins rather than by the ids it
 * holds, since every id a duplicate mints is a fresh nanoid.
 */
export type RelationshipShape = {
  relationshipType: number;
  start: { table: string; columns: string[] };
  end: { table: string; columns: string[] };
};

export function relationshipShape(
  { collections }: ErdDocument,
  relationshipId: string
): RelationshipShape {
  const relationship = collections.relationshipEntities[relationshipId];
  const shapeOf = (end: { tableId: string; columnIds: string[] }) => ({
    table: collections.tableEntities[end.tableId].name,
    columns: end.columnIds.map(
      columnId => collections.tableColumnEntities[columnId].name
    ),
  });

  return {
    relationshipType: relationship.relationshipType,
    start: shapeOf(relationship.start),
    end: shapeOf(relationship.end),
  };
}

export type IndexShape = {
  table: string;
  name: string;
  unique: boolean;
  columns: Array<{ column: string; orderType: number }>;
};

/** Columns in indexColumnIds order, which is the order a generator reads. */
export function indexShape(
  { collections }: ErdDocument,
  indexId: string
): IndexShape {
  const index = collections.indexEntities[indexId];

  return {
    table: collections.tableEntities[index.tableId].name,
    name: index.name,
    unique: index.unique,
    columns: index.indexColumnIds.map(indexColumnId => {
      const indexColumn = collections.indexColumnEntities[indexColumnId];
      return {
        column: collections.tableColumnEntities[indexColumn.columnId].name,
        orderType: indexColumn.orderType,
      };
    }),
  };
}

/** Every entity id one relationship points at — both tables, every column. */
export function relationshipRefs(
  { collections }: ErdDocument,
  relationshipId: string
) {
  const { start, end } = collections.relationshipEntities[relationshipId];
  return [start.tableId, ...start.columnIds, end.tableId, ...end.columnIds];
}

/** Every entity id one index points at — its table and each indexed column. */
export function indexRefs({ collections }: ErdDocument, indexId: string) {
  const index = collections.indexEntities[indexId];
  return [
    index.tableId,
    ...index.indexColumnIds.map(
      indexColumnId => collections.indexColumnEntities[indexColumnId].columnId
    ),
  ];
}

/** Shapes compare as sets, so both sides are read in one settled order. */
export const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
