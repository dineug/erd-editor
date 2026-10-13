import { query } from '@dineug/erd-editor-schema';

import { ColumnOption, OrderType } from '@/constants/schema';
import type { RootState } from '@/engine/state';
import type {
  Column,
  Index,
  Memo,
  Relationship,
  Table,
  TableGroup,
} from '@/internal-types';
import { bHas } from '@/utils/bit';
import { getTableGroupMemberIds } from '@/utils/tableGroup';

import type { Pairing } from './pairEntities';
import { type DiffChange, DiffField, type DiffValue } from './types';

/** Both documents and what pairs across them, which every comparison reads. */
export type DiffContext = {
  prev: RootState;
  next: RootState;
  tables: Pairing;
  columns: Pairing;
  tableGroups: Pairing;
};

const point = (x: number, y: number) => `${Math.round(x)}, ${Math.round(y)}`;
const size = (width: number, height: number) =>
  `${Math.round(width)} × ${Math.round(height)}`;

function changesOf(
  pairs: ReadonlyArray<[DiffField, DiffValue, DiffValue]>
): DiffChange[] {
  return pairs
    .filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => ({ field, before, after }));
}

/** A change shown in words other than the ones it is judged by, such as names for ids. */
function changeShown(
  field: DiffField,
  same: boolean,
  before: DiffValue,
  after: DiffValue
): DiffChange[] {
  return same ? [] : [{ field, before, after }];
}

const columnName = (state: RootState, id: string) =>
  query(state.collections).collection('tableColumnEntities').selectById(id)
    ?.name ?? '';

const tableName = (state: RootState, id: string) =>
  query(state.collections).collection('tableEntities').selectById(id)?.name ??
  '';

/** The group a table is in, or none for an id the document lists no group by. */
const groupOf = (state: RootState, table: Table) =>
  table.groupId && state.doc.tableGroupIds.includes(table.groupId)
    ? table.groupId
    : '';

const groupName = (state: RootState, id: string) =>
  id
    ? (query(state.collections).collection('tableGroupEntities').selectById(id)
        ?.name ?? '')
    : '';

/** Name, comment, the group it is in, where it stands and its colour; never its z-index or the widths its text gives it. */
export function compareTables(
  ctx: DiffContext,
  prev: Table,
  next: Table
): DiffChange[] {
  const prevGroup = groupOf(ctx.prev, prev);
  const nextGroup = groupOf(ctx.next, next);
  const pairedGroup = prevGroup
    ? (ctx.tableGroups.toNext.get(prevGroup) ?? `prev:${prevGroup}`)
    : '';

  return [
    ...changesOf([
      [DiffField.name, prev.name, next.name],
      [DiffField.comment, prev.comment, next.comment],
    ]),
    ...changeShown(
      DiffField.tableGroup,
      pairedGroup === nextGroup,
      groupName(ctx.prev, prevGroup),
      groupName(ctx.next, nextGroup)
    ),
    ...changesOf([
      [
        DiffField.position,
        point(prev.ui.x, prev.ui.y),
        point(next.ui.x, next.ui.y),
      ],
      [DiffField.color, prev.ui.color, next.ui.color],
    ]),
  ];
}

const OPTIONS: ReadonlyArray<[DiffField, number]> = [
  [DiffField.autoIncrement, ColumnOption.autoIncrement],
  [DiffField.primaryKey, ColumnOption.primaryKey],
  [DiffField.unique, ColumnOption.unique],
  [DiffField.notNull, ColumnOption.notNull],
];

/**
 * Name, comment, type, default and the four options, and its place among the
 * columns once it moved, given as where it stood and stands, counted from one.
 */
export function compareColumns(
  prev: Column,
  next: Column,
  moved: { before: number; after: number } | null
): DiffChange[] {
  return [
    ...changesOf([
      [DiffField.name, prev.name, next.name],
      [DiffField.comment, prev.comment, next.comment],
      [DiffField.dataType, prev.dataType, next.dataType],
      [DiffField.default, prev.default, next.default],
      ...OPTIONS.map<[DiffField, DiffValue, DiffValue]>(([field, bit]) => [
        field,
        bHas(prev.options, bit),
        bHas(next.options, bit),
      ]),
    ]),
    ...(moved
      ? [{ field: DiffField.order, before: moved.before, after: moved.after }]
      : []),
  ];
}

type KeyColumn = { id: string; descending: boolean };

const keyColumnsOf = (state: RootState, index: Index): KeyColumn[] =>
  query(state.collections)
    .collection('indexColumnEntities')
    .selectByIds(index.indexColumnIds)
    .map(({ columnId, orderType }) => ({
      id: columnId,
      descending: orderType === OrderType.DESC,
    }));

const keyColumnsText = (state: RootState, columns: KeyColumn[]) =>
  columns
    .map(({ id, descending }) => {
      const name = columnName(state, id);
      return descending ? `${name} DESC` : name;
    })
    .join(', ');

/** The columns of an index in key order, each as the current column it pairs with and its direction. */
export function indexKeyOf(
  ctx: DiffContext,
  index: Index,
  side: 'prev' | 'next'
): string {
  const state = side === 'prev' ? ctx.prev : ctx.next;
  return keyColumnsOf(state, index)
    .map(({ id, descending }) => {
      const paired =
        side === 'prev' ? (ctx.columns.toNext.get(id) ?? `prev:${id}`) : id;
      return `${paired}${descending ? ' DESC' : ''}`;
    })
    .join(',');
}

/** Name, UNIQUE, and the columns in their order and direction, each column by the one it pairs with. */
export function compareIndexes(
  ctx: DiffContext,
  prev: Index,
  next: Index
): DiffChange[] {
  return [
    ...changesOf([
      [DiffField.name, prev.name, next.name],
      [DiffField.unique, prev.unique, next.unique],
    ]),
    ...changeShown(
      DiffField.columns,
      indexKeyOf(ctx, prev, 'prev') === indexKeyOf(ctx, next, 'next'),
      keyColumnsText(ctx.prev, keyColumnsOf(ctx.prev, prev)),
      keyColumnsText(ctx.next, keyColumnsOf(ctx.next, next))
    ),
  ];
}

/** A foreign key as it reads: its columns, the parent and the parent's columns. */
export function foreignKeyText(state: RootState, relationship: Relationship) {
  const names = (ids: string[]) =>
    ids.map(id => columnName(state, id)).join(', ');
  return `${names(relationship.end.columnIds)} → ${tableName(state, relationship.start.tableId)}(${names(relationship.start.columnIds)})`;
}

/** The column pairs of a foreign key, child to parent, as the current columns they pair with. */
export function foreignKeyPairsOf(
  ctx: DiffContext,
  relationship: Relationship,
  side: 'prev' | 'next'
): string {
  const as = (id: string) =>
    side === 'prev' ? (ctx.columns.toNext.get(id) ?? `prev:${id}`) : id;
  return relationship.end.columnIds
    .map(
      (id, index) =>
        `${as(id)}>${as(relationship.start.columnIds[index] ?? '')}`
    )
    .sort()
    .join(',');
}

/** Its column pairs, its kind and what ON DELETE and ON UPDATE do; never where its ends are anchored. */
export function compareForeignKeys(
  ctx: DiffContext,
  prev: Relationship,
  next: Relationship
): DiffChange[] {
  return [
    ...changeShown(
      DiffField.columns,
      foreignKeyPairsOf(ctx, prev, 'prev') ===
        foreignKeyPairsOf(ctx, next, 'next'),
      foreignKeyText(ctx.prev, prev),
      foreignKeyText(ctx.next, next)
    ),
    ...changesOf([
      [
        DiffField.relationshipType,
        prev.relationshipType,
        next.relationshipType,
      ],
      [DiffField.onDelete, prev.onDelete, next.onDelete],
      [DiffField.onUpdate, prev.onUpdate, next.onUpdate],
    ]),
  ];
}

/** What it says, where it stands, its size and its colour; never its z-index. */
export function compareMemos(prev: Memo, next: Memo): DiffChange[] {
  return changesOf([
    [DiffField.value, prev.value, next.value],
    [
      DiffField.position,
      point(prev.ui.x, prev.ui.y),
      point(next.ui.x, next.ui.y),
    ],
    [
      DiffField.size,
      size(prev.ui.width, prev.ui.height),
      size(next.ui.width, next.ui.height),
    ],
    [DiffField.color, prev.ui.color, next.ui.color],
  ]);
}

/** The tables a group holds, each as the current table it pairs with. */
export function groupMembersOf(
  ctx: DiffContext,
  group: TableGroup,
  side: 'prev' | 'next'
): string[] {
  const state = side === 'prev' ? ctx.prev : ctx.next;
  return getTableGroupMemberIds(state, group.id).map(id =>
    side === 'prev' ? (ctx.tables.toNext.get(id) ?? `prev:${id}`) : id
  );
}

const memberNames = (state: RootState, group: TableGroup) =>
  getTableGroupMemberIds(state, group.id)
    .map(id => tableName(state, id))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .join(', ');

/** Name, the tables it holds, its colour and the box it keeps; never its z-index. */
export function compareTableGroups(
  ctx: DiffContext,
  prev: TableGroup,
  next: TableGroup
): DiffChange[] {
  const before = [...groupMembersOf(ctx, prev, 'prev')].sort().join(',');
  const after = [...groupMembersOf(ctx, next, 'next')].sort().join(',');

  return [
    ...changesOf([[DiffField.name, prev.name, next.name]]),
    ...changeShown(
      DiffField.members,
      before === after,
      memberNames(ctx.prev, prev),
      memberNames(ctx.next, next)
    ),
    ...changesOf([
      [DiffField.color, prev.color, next.color],
      [
        DiffField.position,
        point(prev.ui.x, prev.ui.y),
        point(next.ui.x, next.ui.y),
      ],
      [
        DiffField.size,
        size(prev.ui.width, prev.ui.height),
        size(next.ui.width, next.ui.height),
      ],
    ]),
  ];
}
