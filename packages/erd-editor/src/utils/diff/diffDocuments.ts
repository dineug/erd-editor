import { query } from '@dineug/erd-editor-schema';

import {
  COLUMN_KEY_PATH,
  Diff,
  type DiffMap,
  ENTITY_PATH,
  MEMO_VALUE_PATH,
  TABLE_GROUP_NAME_PATH,
} from '@/components/erd/diff-viewer/diff';
import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type {
  Column,
  Index,
  Memo,
  Relationship,
  Table,
} from '@/internal-types';
import { orderByNameASC } from '@/utils/schema-sql/utils';
import { getTableIndexIds } from '@/utils/tableKeys';

import {
  compareColumns,
  compareForeignKeys,
  compareIndexes,
  compareMemos,
  compareTableGroups,
  compareTables,
  type DiffContext,
  foreignKeyPairsOf,
  foreignKeyText,
  groupMembersOf,
  indexKeyOf,
} from './compareEntities';
import {
  emptyPairing,
  longestCommonIndexes,
  pairByOverlap,
  pairEntities,
  type Pairing,
} from './pairEntities';
import {
  type DiffChange,
  type DiffEntry,
  DiffField,
  DiffKind,
  DiffStatus,
  type DocumentDiff,
} from './types';

/** The live entities a document holds, never the ones it keeps removed. */
function liveOf(state: RootState) {
  const { doc, collections } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const tableIds = new Set(doc.tableIds);

  return {
    tables,
    columns: tables.flatMap(table =>
      query(collections)
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds)
    ),
    indexes: tables.flatMap(table =>
      query(collections)
        .collection('indexEntities')
        .selectByIds(getTableIndexIds(state, table.id))
    ),
    relationships: query(collections)
      .collection('relationshipEntities')
      .selectByIds(doc.relationshipIds)
      .filter(
        ({ start, end }) =>
          tableIds.has(start.tableId) && tableIds.has(end.tableId)
      ),
    memos: query(collections)
      .collection('memoEntities')
      .selectByIds(doc.memoIds),
    tableGroups: query(collections)
      .collection('tableGroupEntities')
      .selectByIds(doc.tableGroupIds),
  };
}

type Live = ReturnType<typeof liveOf>;

const named = (name: string) => (name.trim() ? name : null);

/** A saved id as the current one it pairs with, or one no current id can equal. */
const toNext = (pairing: Pairing, id: string) =>
  pairing.toNext.get(id) ?? `prev:${id}`;

/** The first line of a memo, the one a row shows. */
const firstLine = (text: string) => text.split(/\r?\n/, 1)[0].trim();

function statusOf(changes: DiffChange[]): DiffStatus | null {
  if (changes.some(({ field }) => field === DiffField.name)) {
    return DiffStatus.renamed;
  }
  return changes.length ? DiffStatus.modified : null;
}

function entry(
  kind: DiffEntry['kind'],
  status: DiffStatus | null,
  prev: { id: string; name: string } | null,
  next: { id: string; name: string } | null,
  changes: DiffChange[] = [],
  children: DiffEntry[] = []
): DiffEntry {
  return {
    kind,
    status,
    prevId: prev?.id ?? null,
    nextId: next?.id ?? null,
    name: (next ?? prev)!.name,
    prevName: (prev ?? next)!.name,
    changes,
    children,
  };
}

/**
 * The entries of one kind in the current order, those gone from it each put
 * back after the last saved one before it that still pairs, so a removed
 * column reads where it stood.
 */
function inPlace<T extends { id: string }>(
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  pairing: Pairing,
  paired: (prev: T, next: T) => DiffEntry | null,
  added: (next: T) => DiffEntry,
  deleted: (prev: T) => DiffEntry
): DiffEntry[] {
  const byNext = new Map(prev.map(item => [pairing.toNext.get(item.id), item]));
  const rows: Array<{ nextId: string | null; entry: DiffEntry | null }> =
    next.map(item => {
      const before = byNext.get(item.id);
      return {
        nextId: item.id,
        entry: before ? paired(before, item) : added(item),
      };
    });

  let after: string | null = null;
  for (const item of prev) {
    const nextId = pairing.toNext.get(item.id);
    if (nextId) {
      after = nextId;
      continue;
    }
    const at =
      after === null ? -1 : rows.findIndex(row => row.nextId === after);
    let insertAt = at + 1;
    while (insertAt < rows.length && rows[insertAt].nextId === null) insertAt++;
    rows.splice(insertAt, 0, { nextId: null, entry: deleted(item) });
  }

  return rows
    .map(({ entry }) => entry)
    .filter((value): value is DiffEntry => value !== null);
}

const byName = (a: DiffEntry, b: DiffEntry) => orderByNameASC(a, b);

/**
 * The columns, indexes and foreign keys of a table both documents hold, each
 * in the current order, the gone ones where they stood; a column that moved
 * is one outside the longest run both orders share.
 */
function tableChildren(
  ctx: DiffContext,
  pairs: { indexes: Pairing; relationships: Pairing },
  live: { prev: Live; next: Live },
  prevTable: Table,
  nextTable: Table
): DiffEntry[] {
  const columnsOf = (state: RootState, table: Table) =>
    query(state.collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);
  const prevColumns = columnsOf(ctx.prev, prevTable);
  const nextColumns = columnsOf(ctx.next, nextTable);
  const nextIds = new Set(nextColumns.map(({ id }) => id));

  const prevOrder = prevColumns
    .map(({ id }) => ctx.columns.toNext.get(id))
    .filter((id): id is string => Boolean(id && nextIds.has(id)));
  const nextOrder = nextColumns
    .map(({ id }) => id)
    .filter(id => ctx.columns.toPrev.has(id));
  const kept = longestCommonIndexes(prevOrder, nextOrder);
  const moved = new Set(nextOrder.filter((_, index) => !kept.has(index)));
  const placeOf = (columns: Column[], id: string) =>
    columns.findIndex(column => column.id === id) + 1;

  const columns = inPlace<Column>(
    prevColumns,
    nextColumns,
    ctx.columns,
    (prev, next) => {
      const changes = compareColumns(
        prev,
        next,
        moved.has(next.id)
          ? {
              before: placeOf(prevColumns, prev.id),
              after: placeOf(nextColumns, next.id),
            }
          : null
      );
      const status = statusOf(changes);
      return status
        ? entry(DiffKind.column, status, prev, next, changes)
        : null;
    },
    next => entry(DiffKind.column, DiffStatus.added, null, next),
    prev => entry(DiffKind.column, DiffStatus.deleted, prev, null)
  );

  const indexesOf = (side: Live, table: Table) =>
    side.indexes.filter(({ tableId }) => tableId === table.id);
  const indexes = inPlace<Index>(
    indexesOf(live.prev, prevTable),
    indexesOf(live.next, nextTable),
    pairs.indexes,
    (prev, next) => {
      const changes = compareIndexes(ctx, prev, next);
      const status = statusOf(changes);
      return status ? entry(DiffKind.index, status, prev, next, changes) : null;
    },
    next => entry(DiffKind.index, DiffStatus.added, null, next),
    prev => entry(DiffKind.index, DiffStatus.deleted, prev, null)
  );

  const foreignKeysOf = (side: Live, table: Table) =>
    side.relationships.filter(({ end }) => end.tableId === table.id);
  const asForeignKey = (state: RootState, relationship: Relationship) => ({
    id: relationship.id,
    name: foreignKeyText(state, relationship),
  });
  const foreignKeys = inPlace<Relationship>(
    foreignKeysOf(live.prev, prevTable),
    foreignKeysOf(live.next, nextTable),
    pairs.relationships,
    (prev, next) => {
      const changes = compareForeignKeys(ctx, prev, next);
      return changes.length
        ? entry(
            DiffKind.foreignKey,
            DiffStatus.modified,
            asForeignKey(ctx.prev, prev),
            asForeignKey(ctx.next, next),
            changes
          )
        : null;
    },
    next =>
      entry(
        DiffKind.foreignKey,
        DiffStatus.added,
        null,
        asForeignKey(ctx.next, next)
      ),
    prev =>
      entry(
        DiffKind.foreignKey,
        DiffStatus.deleted,
        asForeignKey(ctx.prev, prev),
        null
      )
  );

  return [...columns, ...indexes, ...foreignKeys];
}

const CELL_OF_FIELD: Partial<
  Record<DiffEntry['kind'], Record<string, string>>
> = {
  [DiffKind.table]: {
    [DiffField.name]: FocusType.tableName,
    [DiffField.comment]: FocusType.tableComment,
  },
  [DiffKind.column]: {
    [DiffField.name]: FocusType.columnName,
    [DiffField.comment]: FocusType.columnComment,
    [DiffField.dataType]: FocusType.columnDataType,
    [DiffField.default]: FocusType.columnDefault,
    [DiffField.autoIncrement]: FocusType.columnAutoIncrement,
    [DiffField.primaryKey]: COLUMN_KEY_PATH,
    [DiffField.unique]: FocusType.columnUnique,
    [DiffField.notNull]: FocusType.columnNotNull,
  },
  [DiffKind.memo]: { [DiffField.value]: MEMO_VALUE_PATH },
  [DiffKind.tableGroup]: { [DiffField.name]: TABLE_GROUP_NAME_PATH },
};

/** The path that names an entity, coloured as it comes or goes; none for a column, whose whole row is. */
const NAME_PATH: Partial<Record<DiffEntry['kind'], string>> = {
  [DiffKind.table]: FocusType.tableName,
  [DiffKind.tableGroup]: TABLE_GROUP_NAME_PATH,
};

function mark(map: DiffMap, id: string, path: string, diff: number) {
  const paths = map.get(id) ?? new Map<string, number>();
  paths.set(path, diff);
  map.set(id, paths);
}

/**
 * What each pane marks for an entry: an added one in the current pane, a
 * removed one in the saved pane, and a change both hold in both, a renamed
 * name in its own colour. An index draws nothing to mark.
 */
function markEntry(diff: DocumentDiff, item: DiffEntry) {
  if (item.kind === DiffKind.index) return;
  const name = NAME_PATH[item.kind];

  if (item.status === DiffStatus.added && item.nextId) {
    mark(diff.next, item.nextId, ENTITY_PATH, Diff.insert);
    name && mark(diff.next, item.nextId, name, Diff.insert);
    return;
  }
  if (item.status === DiffStatus.deleted && item.prevId) {
    mark(diff.prev, item.prevId, ENTITY_PATH, Diff.delete);
    name && mark(diff.prev, item.prevId, name, Diff.delete);
    return;
  }

  for (const change of item.changes) {
    const cell = CELL_OF_FIELD[item.kind]?.[change.field];
    const path = cell ?? ENTITY_PATH;
    const flag =
      change.field === DiffField.name && cell ? Diff.rename : Diff.modify;
    item.prevId && mark(diff.prev, item.prevId, path, flag);
    item.nextId && mark(diff.next, item.nextId, path, flag);
  }
}

/**
 * What changed from a saved document to the current one: the entries the diff
 * tree lists and the marks each pane draws, which say the same thing. An entity
 * pairs by id, then one to one by a name it keeps (src/components/erd/AGENTS.md).
 *
 * @example
 * const { entries, prev, next } = diffDocuments(savedStore.state, store.state);
 */
export function diffDocuments(prev: RootState, next: RootState): DocumentDiff {
  const live = { prev: liveOf(prev), next: liveOf(next) };
  const ctx: DiffContext = {
    prev,
    next,
    tables: pairEntities(live.prev.tables, live.next.tables, [
      table => named(table.name),
    ]),
    columns: emptyPairing(),
    tableGroups: emptyPairing(),
  };

  ctx.columns = pairEntities(live.prev.columns, live.next.columns, [
    (column, side) => {
      const name = named(column.name);
      if (name === null) return null;
      const table =
        side === 'prev'
          ? ctx.tables.toNext.get(column.tableId)
          : column.tableId;
      return table ? `${table}|${name}` : null;
    },
  ]);

  ctx.tableGroups = pairEntities(live.prev.tableGroups, live.next.tableGroups, [
    group => named(group.name),
  ]);
  pairByOverlap(
    ctx.tableGroups,
    live.prev.tableGroups.filter(group => named(group.name) === null),
    live.next.tableGroups.filter(group => named(group.name) === null),
    (group, side) => groupMembersOf(ctx, group, side)
  );

  const tableOf = (tableId: string, side: 'prev' | 'next') =>
    side === 'prev' ? ctx.tables.toNext.get(tableId) : tableId;
  const indexes = pairEntities<Index>(live.prev.indexes, live.next.indexes, [
    (index, side) => {
      const name = named(index.name);
      const table = tableOf(index.tableId, side);
      return name && table ? `${table}|${name}` : null;
    },
    (index, side) => {
      const table = tableOf(index.tableId, side);
      return named(index.name) === null && table
        ? `${table}|${indexKeyOf(ctx, index, side)}|${index.unique}`
        : null;
    },
  ]);
  const relationships = pairEntities<Relationship>(
    live.prev.relationships,
    live.next.relationships,
    [
      (relationship, side) => {
        const parent = tableOf(relationship.start.tableId, side);
        const child = tableOf(relationship.end.tableId, side);
        return parent && child
          ? `${parent}|${child}|${foreignKeyPairsOf(ctx, relationship, side)}`
          : null;
      },
    ]
  );
  const memos = pairEntities<Memo>(live.prev.memos, live.next.memos, [
    memo => (memo.value ? memo.value : null),
    memo => `${Math.round(memo.ui.x)},${Math.round(memo.ui.y)}`,
  ]);

  const tableEntries: DiffEntry[] = [];
  const nextTables = new Map(live.next.tables.map(table => [table.id, table]));
  for (const table of live.prev.tables) {
    const pairedId = ctx.tables.toNext.get(table.id);
    const pairedTable = pairedId ? nextTables.get(pairedId) : undefined;
    if (!pairedTable) {
      tableEntries.push(entry(DiffKind.table, DiffStatus.deleted, table, null));
      continue;
    }
    const changes = compareTables(ctx, table, pairedTable);
    const children = tableChildren(
      ctx,
      { indexes, relationships },
      live,
      table,
      pairedTable
    );
    const status = statusOf(changes);
    (status || children.length) &&
      tableEntries.push(
        entry(DiffKind.table, status, table, pairedTable, changes, children)
      );
  }
  for (const table of live.next.tables) {
    ctx.tables.toPrev.has(table.id) ||
      tableEntries.push(entry(DiffKind.table, DiffStatus.added, null, table));
  }

  const groupEntries: DiffEntry[] = [];
  const nextGroups = new Map(
    live.next.tableGroups.map(group => [group.id, group])
  );
  for (const group of live.prev.tableGroups) {
    const pairedGroup = nextGroups.get(toNext(ctx.tableGroups, group.id));
    if (!pairedGroup) {
      groupEntries.push(
        entry(DiffKind.tableGroup, DiffStatus.deleted, group, null)
      );
      continue;
    }
    const changes = compareTableGroups(ctx, group, pairedGroup);
    const status = statusOf(changes);
    status &&
      groupEntries.push(
        entry(DiffKind.tableGroup, status, group, pairedGroup, changes)
      );
  }
  for (const group of live.next.tableGroups) {
    ctx.tableGroups.toPrev.has(group.id) ||
      groupEntries.push(
        entry(DiffKind.tableGroup, DiffStatus.added, null, group)
      );
  }

  const asMemo = (memo: Memo) => ({ id: memo.id, name: firstLine(memo.value) });
  const memoEntries = inPlace<Memo>(
    live.prev.memos,
    live.next.memos,
    memos,
    (prev, next) => {
      const changes = compareMemos(prev, next);
      return changes.length
        ? entry(
            DiffKind.memo,
            DiffStatus.modified,
            asMemo(prev),
            asMemo(next),
            changes
          )
        : null;
    },
    next => entry(DiffKind.memo, DiffStatus.added, null, asMemo(next)),
    prev => entry(DiffKind.memo, DiffStatus.deleted, asMemo(prev), null)
  );

  const diff: DocumentDiff = {
    entries: {
      tables: tableEntries.sort(byName),
      tableGroups: groupEntries.sort(byName),
      memos: memoEntries,
    },
    prev: new Map(),
    next: new Map(),
  };

  const walk = (items: DiffEntry[]) =>
    items.forEach(item => {
      markEntry(diff, item);
      walk(item.children);
    });
  walk(tableEntries);
  walk(groupEntries);
  walk(memoEntries);

  return diff;
}
