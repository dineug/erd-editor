import { AnyAction } from '@dineug/r-html';

import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import { moveToMemoAction } from '@/engine/modules/memo/atom.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { resizeTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { RootState } from '@/engine/state';
import {
  getContentRectAfter,
  type TableMove,
} from '@/konva/scene/contentBounds';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getTableGroupMemoMoves, getTableGroupWraps } from '@/utils/tableGroup';

/**
 * What a placement lands as: each table and each memo it laid out at its point, every other memo of
 * a moved group riding with its tables, each group with members round them and the view centred on
 * the box all of it fills, read before the move. Dispatched together, they are one undo entry.
 *
 * @example
 * store.dispatch(toPlacementActions(store.state, points));
 */
export function toPlacementActions(
  state: RootState,
  tables: ReadonlyArray<TableMove>,
  source: GeometrySource = 'document',
  memos: ReadonlyArray<TableMove> = []
): AnyAction[] {
  const memoMoves = [
    ...memos,
    ...getTableGroupMemoMoves(
      state,
      tables,
      memos.map(({ id }) => id)
    ),
  ];
  const groups = getTableGroupWraps(state, tables, memoMoves);
  const actions = [
    ...tables.map(({ id, x, y }) => moveToTableAction({ id, x, y })),
    ...memoMoves.map(({ id, x, y }) => moveToMemoAction({ id, x, y })),
    ...groups.map(({ id, x, y, width, height }) =>
      resizeTableGroupAction({ id, x, y, width, height })
    ),
  ];
  const content = getContentRectAfter(state, tables, source, groups, memoMoves);
  if (!content) return actions;

  const origin = getScrollToCenter(getViewTransform(state, source), {
    x: content.x + content.width / 2,
    y: content.y + content.height / 2,
  });

  return [...actions, scrollToAction({ originX: origin.x, originY: origin.y })];
}
