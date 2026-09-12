import { query } from '@dineug/erd-editor-schema';

import { COLUMN_HEIGHT } from '@/constants/layout';
import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { getVisibleColumnIds, getVisibleIds } from '@/konva/scene/viewLayout';
import { getCullingRect, isTableVisible } from '@/konva/scene/viewport';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

export type ColumnDropTarget = {
  tableId: string;
  columnId: string;
  index: number;
};

/**
 * The row a column drag would drop on, in canvas coordinates, or null over a
 * header, over bare canvas and past the last row. Arithmetic on the rects the
 * scene lays rows out with, never a hit canvas read, which costs a frame.
 */
export function findColumnDropTarget(
  state: RootState,
  point: Point,
  source: GeometrySource = 'document'
): ColumnDropTarget | null {
  const { collections } = state;
  const cullingRect = getCullingRect(state, source);

  // Painted order, reversed: the row a pointer lands on belongs to whichever
  // table is drawn over the others there.
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(getVisibleIds(state, source).tableIds)
    .filter(table => isTableVisible(cullingRect, state, table, source))
    .sort((a, b) => b.ui.zIndex - a.ui.zIndex);

  for (const table of tables) {
    const rect = getTableRect(state, table, source);
    const inside =
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height;
    if (!inside) continue;

    const firstRowY = getColumnRect(state, table, 0, source).y;
    if (point.y < firstRowY) return null;

    const index = Math.floor((point.y - firstRowY) / COLUMN_HEIGHT);
    const columnId = getVisibleColumnIds(state, table, source)[index];
    if (!columnId) return null;

    return { tableId: table.id, columnId, index };
  }

  return null;
}
