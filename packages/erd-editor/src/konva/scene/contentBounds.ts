import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import {
  getMemoRect,
  getTableRect,
  type Rect,
  unionRect,
} from '@/konva/scene/metrics';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import {
  getTableGroupRect,
  isTableGroupShown,
  type TableGroupWrap,
} from '@/utils/tableGroup';

export { unionRect } from '@/konva/scene/metrics';

/** A table and the point it is about to be moved to, named before the move is dispatched. */
export type TableMove = { id: string; x: number; y: number };

/**
 * The box every table, memo and shown group of the document fits inside, in
 * scene units, or null for a document holding none. Computed afresh on every call: the state is
 * one mutable proxy written in place, so a cache keyed on it never sees a move.
 */
export function getContentRect(state: RootState): Rect | null {
  return getContentRectAfter(state, []);
}

/**
 * The box the scene drawn from a source fits inside: the document's content
 * rect, or for a view the tables it shows at their view points and no memo,
 * since a view places none. A view showing nothing has no box.
 */
export function getSceneContentRect(
  state: RootState,
  source: GeometrySource = 'document'
): Rect | null {
  return getContentRectAfter(state, [], source);
}

/**
 * One box per table, memo and group the source shows, each table at the point
 * named for it and each group named at its rect. The reader that asks which
 * entity is nearest needs them apart, and the box below folds them together.
 */
export function getContentRects(
  state: RootState,
  moves: ReadonlyArray<TableMove> = [],
  source: GeometrySource = 'document',
  groupRects: ReadonlyArray<TableGroupWrap> = []
): Rect[] {
  const { collections, doc } = state;
  // The document's two lists read directly: the third getVisibleIds carries,
  // the relationships, is one an observer here would otherwise depend on for nothing.
  const { tableIds, memoIds, tableGroupIds } =
    source === 'document' ? doc : getVisibleIds(state, source);
  const moved = new Map(moves.map(move => [move.id, move]));
  // A moved member is left out of its group's box, which would otherwise
  // reach for where it stood; its own box below already holds where it goes.
  const groups =
    tableGroupIds.length && isTableGroupShown(state)
      ? query(collections)
          .collection('tableGroupEntities')
          .selectByIds(tableGroupIds)
      : [];
  const excludeTableIds = moves.map(move => move.id);
  const placedGroups = new Map(
    groupRects.map(({ id, ...rect }): [string, Rect] => [id, rect])
  );
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(memoIds);

  return [
    ...tables.map(table => {
      const rect = getTableRect(state, table, source);
      const move = moved.get(table.id);

      return move ? { ...rect, x: move.x, y: move.y } : rect;
    }),
    ...memos.map(getMemoRect),
    ...groups.map(
      group =>
        placedGroups.get(group.id) ??
        getTableGroupRect(state, group, { excludeTableIds })
    ),
  ];
}

/**
 * The content rect as it will stand once each table named is at its point and
 * each group named at its rect. A placement centres the view on where they land
 * in the dispatch that moves them, so it needs the box before any reducer ran.
 */
export function getContentRectAfter(
  state: RootState,
  moves: ReadonlyArray<TableMove>,
  source: GeometrySource = 'document',
  groupRects: ReadonlyArray<TableGroupWrap> = []
): Rect | null {
  const boxes = getContentRects(state, moves, source, groupRects);

  return boxes.length ? boxes.reduce(unionRect) : null;
}
