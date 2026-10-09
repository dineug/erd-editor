import { query } from '@dineug/erd-editor-schema';

import { TABLE_GROUP_PADDING } from '@/constants/layout';
import { RootState } from '@/engine/state';
import { Point, Table, TableGroup } from '@/internal-types';
import { unionRect } from '@/konva/scene/contentBounds';
import { getTableRect, type Rect } from '@/konva/scene/metrics';
import { arrayHas } from '@/utils/arrayHas';

export type TableGroupRectOptions = {
  /** Tables the box leaves out though they are members, the ones a drag holds. */
  excludeTableIds?: ReadonlyArray<string>;
};

/**
 * The group a table is in, or '' for none: a groupId naming no group the
 * document lists reads as none, whatever the table saved.
 */
export function getTableGroupId({ doc }: RootState, table: Table): string {
  return table.groupId && doc.tableGroupIds.includes(table.groupId)
    ? table.groupId
    : '';
}

function getMemberTables(state: RootState, groupId: string): Table[] {
  const { doc, collections } = state;
  if (!groupId || !doc.tableGroupIds.includes(groupId)) return [];

  return query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .filter(table => table.groupId === groupId);
}

/** The ids of the tables a group holds, in document order; none for a group the document does not list. */
export function getTableGroupMemberIds(
  state: RootState,
  groupId: string
): string[] {
  return getMemberTables(state, groupId).map(({ id }) => id);
}

/** A rect grown by the padding on every side. */
export function padRect(rect: Rect, padding = TABLE_GROUP_PADDING): Rect {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

/**
 * The box a group is drawn and hit in: its stored rect united with each member
 * table's rect and the padding around it, so a member that grows never sticks
 * out and nothing is written for it.
 *
 * @example
 * const box = getTableGroupRect(state, group, { excludeTableIds: dragged });
 */
export function getTableGroupRect(
  state: RootState,
  group: TableGroup,
  { excludeTableIds = [] }: TableGroupRectOptions = {}
): Rect {
  const { x, y, width, height } = group.ui;
  const isExcluded = arrayHas(excludeTableIds);

  return getMemberTables(state, group.id)
    .filter(table => !isExcluded(table.id))
    .reduce<Rect>(
      (rect, table) => unionRect(rect, padRect(getTableRect(state, table))),
      { x, y, width, height }
    );
}

/**
 * The rect a group made from tables takes: their bounds and the padding around
 * them, or null for no table the document lists.
 */
export function getTablesGroupRect(
  state: RootState,
  tableIds: ReadonlyArray<string>
): Rect | null {
  const { doc, collections } = state;
  const rects = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds.filter(arrayHas(doc.tableIds)))
    .map(table => getTableRect(state, table));

  return rects.length ? padRect(rects.reduce(unionRect)) : null;
}

/** The centre of a table's box, the point every membership test reads. */
export function getTableCenter(state: RootState, table: Table): Point {
  const { x, y, width, height } = getTableRect(state, table);
  return { x: x + width / 2, y: y + height / 2 };
}

/** Whether the point lies in the rect, its edges included. */
export function isPointInRect({ x, y }: Point, rect: Rect): boolean {
  return (
    rect.x <= x &&
    x <= rect.x + rect.width &&
    rect.y <= y &&
    y <= rect.y + rect.height
  );
}

/**
 * The topmost group whose box holds the point: the highest zIndex, and of two
 * at one the later in doc.tableGroupIds, the one drawn over the other. Null
 * where no group's box reaches.
 *
 * @example
 * const group = findTableGroupAt(state, getTableCenter(state, table));
 */
export function findTableGroupAt(
  state: RootState,
  point: Point,
  options?: TableGroupRectOptions
): TableGroup | null {
  const { doc, collections } = state;

  return query(collections)
    .collection('tableGroupEntities')
    .selectByIds(doc.tableGroupIds)
    .reduce<TableGroup | null>(
      (top, group) =>
        (!top || top.ui.zIndex <= group.ui.zIndex) &&
        isPointInRect(point, getTableGroupRect(state, group, options))
          ? group
          : top,
      null
    );
}

/** The zIndex that lifts a group over every other group, tables and memos aside. */
export const nextTableGroupZIndex = (groups: TableGroup[]) =>
  Math.max(0, ...groups.map(({ ui }) => ui.zIndex)) + 1;
