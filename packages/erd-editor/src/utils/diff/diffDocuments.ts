import { query } from '@dineug/erd-editor-schema';

import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type {
  Column,
  Index,
  Memo,
  Relationship,
  Table,
} from '@/internal-types';
import {
  COLUMN_KEY_PATH,
  Diff,
  type DiffMap,
  ENTITY_PATH,
  MEMO_VALUE_PATH,
  TABLE_GROUP_NAME_PATH,
} from '@/utils/diff/diff';
import { getTableIndexIds } from '@/utils/tableKeys';
import { orderByNameASC } from '@/utils/tableName';

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

/**
 * What an entry names an entity by: its own name, a foreign key's text, a
 * memo's first line, and a table's or column's logical name beside it.
 */
type Named = { id: string; name: string; logicalName?: string };

const named = (name: string) => (name.trim() ? name : null);

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
  prev: Named | null,
  next: Named | null,
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
    logicalName: (next ?? prev)!.logicalName ?? '',
    prevLogicalName: (prev ?? next)!.logicalName ?? '',
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
  kind: DiffKind,
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  pairing: Pairing,
  compare: (prev: T, next: T) => DiffChange[],
  nameOf: (item: T, side: 'prev' | 'next') => Named
): DiffEntry[] {
  const pairedEntry = (prevItem: T, nextItem: T) => {
    const changes = compare(prevItem, nextItem);
    const status = statusOf(changes);
    return status
      ? entry(
          kind,
          status,
          nameOf(prevItem, 'prev'),
          nameOf(nextItem, 'next'),
          changes
        )
      : null;
  };

  const byNext = new Map(prev.map(item => [pairing.toNext.get(item.id), item]));
  const rows: Array<{ nextId: string | null; entry: DiffEntry | null }> =
    next.map(item => {
      const before = byNext.get(item.id);
      return {
        nextId: item.id,
        entry: before
          ? pairedEntry(before, item)
          : entry(kind, DiffStatus.added, null, nameOf(item, 'next')),
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
    rows.splice(insertAt, 0, {
      nextId: null,
      entry: entry(kind, DiffStatus.deleted, nameOf(item, 'prev'), null),
    });
  }

  return rows
    .map(({ entry }) => entry)
    .filter((value): value is DiffEntry => value !== null);
}

/**
 * The entries of one kind in name order: each saved one gone or changed in or
 * under it, then each current one that pairs with none.
 */
function listedByName<T extends Named>(
  kind: DiffKind,
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  pairing: Pairing,
  compare: (prev: T, next: T) => DiffChange[],
  childrenOf: (prev: T, next: T) => DiffEntry[] = () => []
): DiffEntry[] {
  const nextById = new Map(next.map(item => [item.id, item]));
  const entries: DiffEntry[] = [];

  for (const item of prev) {
    const pairedId = pairing.toNext.get(item.id);
    const paired = pairedId ? nextById.get(pairedId) : undefined;
    if (!paired) {
      entries.push(entry(kind, DiffStatus.deleted, item, null));
      continue;
    }
    const changes = compare(item, paired);
    const children = childrenOf(item, paired);
    const status = statusOf(changes);
    (status || children.length) &&
      entries.push(entry(kind, status, item, paired, changes, children));
  }
  for (const item of next) {
    pairing.toPrev.has(item.id) ||
      entries.push(entry(kind, DiffStatus.added, null, item));
  }

  return entries.sort(orderByNameASC);
}

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
    DiffKind.column,
    prevColumns,
    nextColumns,
    ctx.columns,
    (prev, next) =>
      compareColumns(
        prev,
        next,
        moved.has(next.id)
          ? {
              before: placeOf(prevColumns, prev.id),
              after: placeOf(nextColumns, next.id),
            }
          : null
      ),
    column => column
  );

  const indexesOf = (side: Live, table: Table) =>
    side.indexes.filter(({ tableId }) => tableId === table.id);
  const indexes = inPlace<Index>(
    DiffKind.index,
    indexesOf(live.prev, prevTable),
    indexesOf(live.next, nextTable),
    pairs.indexes,
    (prev, next) => compareIndexes(ctx, prev, next),
    index => index
  );

  const foreignKeysOf = (side: Live, table: Table) =>
    side.relationships.filter(({ end }) => end.tableId === table.id);
  const foreignKeys = inPlace<Relationship>(
    DiffKind.foreignKey,
    foreignKeysOf(live.prev, prevTable),
    foreignKeysOf(live.next, nextTable),
    pairs.relationships,
    (prev, next) => compareForeignKeys(ctx, prev, next),
    (relationship, side) => ({
      id: relationship.id,
      name: foreignKeyText(ctx[side], relationship),
    })
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
  const tables = pairEntities(live.prev.tables, live.next.tables, [
    table => named(table.name),
  ]);
  const tableOf = (tableId: string, side: 'prev' | 'next') =>
    side === 'prev' ? tables.toNext.get(tableId) : tableId;
  /** A column's or an index's key: the table it is in, as paired, and its name. */
  const byTableAndName = (
    item: { tableId: string; name: string },
    side: 'prev' | 'next'
  ) => {
    const name = named(item.name);
    const table = tableOf(item.tableId, side);
    return name && table ? `${table}|${name}` : null;
  };

  const ctx: DiffContext = {
    prev,
    next,
    tables,
    columns: pairEntities(live.prev.columns, live.next.columns, [
      byTableAndName,
    ]),
    tableGroups: pairEntities(live.prev.tableGroups, live.next.tableGroups, [
      group => named(group.name),
    ]),
  };
  pairByOverlap(
    ctx.tableGroups,
    live.prev.tableGroups.filter(group => named(group.name) === null),
    live.next.tableGroups.filter(group => named(group.name) === null),
    (group, side) => groupMembersOf(ctx, group, side)
  );

  const indexes = pairEntities<Index>(live.prev.indexes, live.next.indexes, [
    byTableAndName,
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

  const tableEntries = listedByName(
    DiffKind.table,
    live.prev.tables,
    live.next.tables,
    ctx.tables,
    (prevTable, nextTable) => compareTables(ctx, prevTable, nextTable),
    (prevTable, nextTable) =>
      tableChildren(ctx, { indexes, relationships }, live, prevTable, nextTable)
  );
  const groupEntries = listedByName(
    DiffKind.tableGroup,
    live.prev.tableGroups,
    live.next.tableGroups,
    ctx.tableGroups,
    (prevGroup, nextGroup) => compareTableGroups(ctx, prevGroup, nextGroup)
  );
  const memoEntries = inPlace<Memo>(
    DiffKind.memo,
    live.prev.memos,
    live.next.memos,
    memos,
    compareMemos,
    memo => ({ id: memo.id, name: firstLine(memo.value) })
  );

  const diff: DocumentDiff = {
    entries: {
      tables: tableEntries,
      tableGroups: groupEntries,
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
