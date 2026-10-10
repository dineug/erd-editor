import { query } from '@dineug/erd-editor-schema';

import {
  TABLE_GROUP_PADDING,
  TABLE_GROUP_TITLE_HEIGHT,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Point, Table, TableGroup } from '@/internal-types';
import { getTableRect, type Rect, unionRect } from '@/konva/scene/metrics';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';
import { contrastTextColor } from '@/utils/contrastText';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { toOpaqueHex } from '@/utils/tableColor';

export type TableGroupRectOptions = {
  /** Tables the box leaves out though they are members, the ones a drag holds. */
  excludeTableIds?: ReadonlyArray<string>;
};

/** A group's box options, and the members it is read from when the caller holds them. */
export type TableGroupMemberOptions = TableGroupRectOptions & {
  /** The group's member tables, which spares a walk over every table of the document. */
  members?: ReadonlyArray<Table>;
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

/**
 * A rect grown by the padding on every side and by the title bar on top too,
 * so the bar a group draws along the top of its box clears what it holds.
 */
export function padRect(rect: Rect, padding = TABLE_GROUP_PADDING): Rect {
  const top = padding + TABLE_GROUP_TITLE_HEIGHT;

  return {
    x: rect.x - padding,
    y: rect.y - top,
    width: rect.width + padding * 2,
    height: rect.height + padding + top,
  };
}

/**
 * The box a group is drawn and hit in: its stored rect united with each member
 * table's rect and the padding around it, title bar included, so a member that
 * grows never sticks out and nothing is written for it.
 *
 * @example
 * const box = getTableGroupRect(state, group, { excludeTableIds: dragged });
 */
export function getTableGroupRect(
  state: RootState,
  group: TableGroup,
  {
    excludeTableIds = [],
    members = getMemberTables(state, group.id),
  }: TableGroupMemberOptions = {}
): Rect {
  const { x, y, width, height } = group.ui;
  const excluded = new Set(excludeTableIds);

  return members
    .filter(table => !excluded.has(table.id))
    .reduce<Rect>(
      (rect, table) => unionRect(rect, padRect(getTableRect(state, table))),
      { x, y, width, height }
    );
}

/**
 * Each group's box seeded at its stored rect, keyed by id, for one walk over
 * the tables to grow with growTableGroupBox: every box out of one pass, where
 * a box apiece walks every table once per group.
 */
export function seedTableGroupBoxes(
  groups: ReadonlyArray<TableGroup>
): Map<string, Rect> {
  return new Map(
    groups.map(({ id, ui: { x, y, width, height } }) => [
      id,
      { x, y, width, height },
    ])
  );
}

/**
 * Grows the box of the group a table names by the table's rect and padding; a
 * table naming no seeded group, a removed one among them, grows none.
 */
export function growTableGroupBox(
  boxes: Map<string, Rect>,
  table: Table,
  rect: Rect
): void {
  const box = table.groupId ? boxes.get(table.groupId) : undefined;
  if (box) boxes.set(table.groupId, unionRect(box, padRect(rect)));
}

/**
 * The box of every group the document lists, keyed by id, each as
 * getTableGroupRect reads it, out of one walk over the tables.
 *
 * @example
 * const boxes = getTableGroupRects(state, { excludeTableIds: dragged });
 */
export function getTableGroupRects(
  state: RootState,
  { excludeTableIds = [] }: TableGroupRectOptions = {}
): Map<string, Rect> {
  const { doc, collections } = state;
  const boxes = seedTableGroupBoxes(
    query(collections)
      .collection('tableGroupEntities')
      .selectByIds(doc.tableGroupIds)
  );
  if (!boxes.size) return boxes;

  const excluded = new Set(excludeTableIds);
  query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .forEach(table => {
      if (excluded.has(table.id)) return;
      growTableGroupBox(boxes, table, getTableRect(state, table));
    });

  return boxes;
}

/**
 * The member tables of every group the document lists, keyed by id, each list
 * in document order, out of one walk over the tables; a group with no member
 * is left out.
 */
export function getTableGroupMembers(state: RootState): Map<string, Table[]> {
  const { doc, collections } = state;
  const listed = new Set(doc.tableGroupIds);
  const members = new Map<string, Table[]>();
  if (!listed.size) return members;

  query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .forEach(table => {
      if (!listed.has(table.groupId)) return;

      const list = members.get(table.groupId);
      list ? list.push(table) : members.set(table.groupId, [table]);
    });

  return members;
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

/** A group and the rect a placement gives it. */
export type TableGroupWrap = Rect & { id: string };

/**
 * The rect each listed group with a member takes once every table named stands
 * at its point: its members' bounds and the padding, what an automatic
 * placement writes. A group with no member keeps its rect and is left out.
 *
 * @example
 * const resizes = getTableGroupWraps(state, points).map(resizeTableGroupAction);
 */
export function getTableGroupWraps(
  state: RootState,
  points: ReadonlyArray<Point & { id: string }> = []
): TableGroupWrap[] {
  const { doc, collections } = state;
  const placed = new Map(points.map(point => [point.id, point]));
  const rectsByGroup = new Map<string, Rect[]>();

  query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .forEach(table => {
      const groupId = getTableGroupId(state, table);
      if (!groupId) return;

      const { x, y } = placed.get(table.id) ?? table.ui;
      const rect = { ...getTableRect(state, table), x, y };
      const rects = rectsByGroup.get(groupId);
      rects ? rects.push(rect) : rectsByGroup.set(groupId, [rect]);
    });

  return doc.tableGroupIds.flatMap(id => {
    const rects = rectsByGroup.get(id);
    return rects ? [{ ...padRect(rects.reduce(unionRect)), id }] : [];
  });
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
  return findTableGroupsAt(state, [point], options)[0];
}

/** Where findTableGroupsAt reads the boxes: built from the tables, or handed in built. */
export type TableGroupFindOptions = TableGroupRectOptions & {
  /** Every group's box, keyed as getTableGroupRects keys them, read in place of building them. */
  boxes?: ReadonlyMap<string, Rect>;
};

/**
 * The topmost group at each point, as findTableGroupAt finds it, every box
 * read once for all of them, which a drag of many tables asks every step; no
 * point, and no box is built.
 *
 * @example
 * const groups = findTableGroupsAt(state, centers, { excludeTableIds: ids });
 */
export function findTableGroupsAt(
  state: RootState,
  points: ReadonlyArray<Point>,
  { boxes, ...options }: TableGroupFindOptions = {}
): Array<TableGroup | null> {
  if (!points.length) return [];

  const { doc, collections } = state;
  const rects = boxes ?? getTableGroupRects(state, options);
  const candidates = query(collections)
    .collection('tableGroupEntities')
    .selectByIds(doc.tableGroupIds)
    .flatMap(group => {
      const rect = rects.get(group.id);
      return rect ? [{ group, rect }] : [];
    });

  return points.map(point =>
    candidates.reduce<TableGroup | null>(
      (top, { group, rect }) =>
        (!top || top.ui.zIndex <= group.ui.zIndex) && isPointInRect(point, rect)
          ? group
          : top,
      null
    )
  );
}

/** The zIndex that lifts a group over every other group, tables and memos aside. */
export const nextTableGroupZIndex = (groups: TableGroup[]) =>
  Math.max(0, ...groups.map(({ ui }) => ui.zIndex)) + 1;

/**
 * Whether the document shows its groups, boxes and header colors alike. The
 * bit hides them, so a document saved before groups existed shows them.
 */
export const isTableGroupShown = ({ settings }: RootState) =>
  !bHas(settings.show, Show.hideTableGroup);

/** A group's color as an opaque hex and the black or white text drawn over it. */
export type TableGroupColors = { background: string; foreground: string };

/**
 * The colors a group paints with, or null for a group with no color or one
 * toOpaqueHex cannot read, which the neutral theme colors paint instead.
 */
export function getTableGroupColors(
  group: TableGroup
): TableGroupColors | null {
  const background = toOpaqueHex(group.color);
  const foreground = background && contrastTextColor(background);

  return background && foreground ? { background, foreground } : null;
}

/**
 * The colors a member table's header takes from its group, or null where it
 * keeps its own: in a view, while groups are hidden, out of any group, or in
 * a group with no color it can read.
 *
 * @example
 * const tint = getTableHeaderTint(state, table, source);
 */
export function getTableHeaderTint(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): TableGroupColors | null {
  if (source !== 'document' || !isTableGroupShown(state)) return null;

  return getTableGroupTint(state, getTableGroupId(state, table), source);
}

/**
 * The colors a header takes from the group named, one already read as listed ('' for none), as
 * getTableHeaderTint decides them: a scene naming each table's group off one read of the list hands
 * it here, so a group coming or going re-renders no table it does not reach.
 *
 * @example
 * const tint = getTableGroupTint(state, props.tableGroupId, source);
 */
export function getTableGroupTint(
  state: RootState,
  groupId: string,
  source: GeometrySource = 'document'
): TableGroupColors | null {
  if (!groupId || source !== 'document' || !isTableGroupShown(state)) {
    return null;
  }

  const group = state.collections.tableGroupEntities[groupId];
  return group ? getTableGroupColors(group) : null;
}
