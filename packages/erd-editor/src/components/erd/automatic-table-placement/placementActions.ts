import { AnyAction } from '@dineug/r-html';

import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { moveToTableAction } from '@/engine/modules/table/atom.actions';
import { resizeTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { RootState } from '@/engine/state';
import {
  getContentRectAfter,
  type TableMove,
} from '@/konva/scene/contentBounds';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getTableGroupWraps } from '@/utils/tableGroup';

/**
 * What a placement lands as: each table at its point, each group with members
 * at the rect round where they land, and the view centred on the box all of it
 * fills, read before the move. Dispatched together, they are one undo entry.
 *
 * @example
 * store.dispatch(toPlacementActions(store.state, points));
 */
export function toPlacementActions(
  state: RootState,
  tables: ReadonlyArray<TableMove>,
  source: GeometrySource = 'document'
): AnyAction[] {
  const groups = getTableGroupWraps(state, tables);
  const actions = [
    ...tables.map(({ id, x, y }) => moveToTableAction({ id, x, y })),
    ...groups.map(({ id, x, y, width, height }) =>
      resizeTableGroupAction({ id, x, y, width, height })
    ),
  ];
  const content = getContentRectAfter(state, tables, source, groups);
  if (!content) return actions;

  const origin = getScrollToCenter(getViewTransform(state, source), {
    x: content.x + content.width / 2,
    y: content.y + content.height / 2,
  });

  return [...actions, scrollToAction({ originX: origin.x, originY: origin.y })];
}
