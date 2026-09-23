import {
  defaultToWidth,
  measureTableSize,
  type RootState,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

import {
  type AgentSnapshotIndex,
  type AgentSnapshotMemo,
  type AgentSnapshotRelationship,
  type AgentSnapshotSettings,
  type AgentSnapshotTable,
  relationshipTypeName,
  toSnapshotIndex,
  toSnapshotMemo,
  toSnapshotRelationship,
  toSnapshotSettings,
  toSnapshotTable,
} from '@/tools/snapshot';

/** The size a table takes on the ERD canvas. */
export type TableSize = { width: number; height: number };

export type ListedTable = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columnCount: number;
};

export type ListedRelationship = {
  id: string;
  relationshipType: string;
  startTableId: string;
  endTableId: string;
};

export type ListedIndex = {
  id: string;
  tableId: string;
  name: string;
  unique: boolean;
};

export type ListedMemo = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * What erd_list answers: the settings, and every live entity by id with what
 * placing it takes, the columns and memo text left to erd_get.
 */
export type DocumentList = {
  settings: AgentSnapshotSettings;
  tables: ListedTable[];
  relationships: ListedRelationship[];
  indexes: ListedIndex[];
  memos: ListedMemo[];
};

export type DetailedTable = AgentSnapshotTable & TableSize;

/** The ids erd_get is asked for, by kind. */
export type EntityIds = {
  readonly tableIds?: readonly string[];
  readonly relationshipIds?: readonly string[];
  readonly indexIds?: readonly string[];
  readonly memoIds?: readonly string[];
};

/** What erd_get answers: only the kinds asked for, and the ids that name nothing live. */
export type EntityDetails = {
  tables?: DetailedTable[];
  relationships?: AgentSnapshotRelationship[];
  indexes?: AgentSnapshotIndex[];
  memos?: AgentSnapshotMemo[];
  missing?: string[];
};

type TableEntity = RootState['collections']['tableEntities'][string];

/**
 * A table's box as the table sort sizes it once the peer's hooks have measured
 * its text, which they do a few milliseconds after a load whatever the file
 * carried: the height exact, the width from about 10 px a character.
 */
export const tableSize = (table: TableEntity, state: RootState): TableSize =>
  measureTableSize(table, state, defaultToWidth);

export function toDocumentList(state: RootState): DocumentList {
  const { settings, doc, collections } = state;
  const select = query(collections);

  return {
    settings: toSnapshotSettings(settings),
    tables: select
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map(table => ({
        id: table.id,
        name: table.name,
        x: table.ui.x,
        y: table.ui.y,
        ...tableSize(table, state),
        columnCount: select
          .collection('tableColumnEntities')
          .selectByIds(table.columnIds).length,
      })),
    relationships: select
      .collection('relationshipEntities')
      .selectByIds(doc.relationshipIds)
      .map(({ id, relationshipType, start, end }) => ({
        id,
        relationshipType: relationshipTypeName(relationshipType),
        startTableId: start.tableId,
        endTableId: end.tableId,
      })),
    indexes: select
      .collection('indexEntities')
      .selectByIds(doc.indexIds)
      .map(({ id, tableId, name, unique }) => ({ id, tableId, name, unique })),
    memos: select
      .collection('memoEntities')
      .selectByIds(doc.memoIds)
      .map(({ id, ui }) => ({
        id,
        x: ui.x,
        y: ui.y,
        width: ui.width,
        height: ui.height,
      })),
  };
}

/** The ids asked for once each, in the order asked, split by whether a live list holds them. */
function partition(ids: readonly string[], live: readonly string[]) {
  const unique = [...new Set(ids)];
  return {
    found: unique.filter(id => live.includes(id)),
    missing: unique.filter(id => !live.includes(id)),
  };
}

/**
 * The entities named, in full, each kind in the order its ids were given. A
 * removed entity keeps its record as an LWW tombstone, so an id counts only
 * when its kind's live list holds it; any other is reported once as missing.
 */
export function toEntityDetails(
  state: RootState,
  ids: EntityIds
): EntityDetails {
  const { doc, collections } = state;
  const select = query(collections);
  const details: EntityDetails = {};
  const missing = new Set<string>();

  const pick = (asked: readonly string[] | undefined, live: string[]) => {
    const { found, missing: absent } = partition(asked ?? [], live);
    absent.forEach(id => missing.add(id));
    return found;
  };

  if (ids.tableIds) {
    details.tables = select
      .collection('tableEntities')
      .selectByIds(pick(ids.tableIds, doc.tableIds))
      .map(table => {
        const { columns, ...rest } = toSnapshotTable(select, table);
        return { ...rest, ...tableSize(table, state), columns };
      });
  }
  if (ids.relationshipIds) {
    details.relationships = select
      .collection('relationshipEntities')
      .selectByIds(pick(ids.relationshipIds, doc.relationshipIds))
      .map(toSnapshotRelationship);
  }
  if (ids.indexIds) {
    details.indexes = select
      .collection('indexEntities')
      .selectByIds(pick(ids.indexIds, doc.indexIds))
      .map(index => toSnapshotIndex(select, index));
  }
  if (ids.memoIds) {
    details.memos = select
      .collection('memoEntities')
      .selectByIds(pick(ids.memoIds, doc.memoIds))
      .map(toSnapshotMemo);
  }
  if (missing.size) details.missing = [...missing];

  return details;
}
