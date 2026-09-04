import { query } from '@dineug/erd-editor-schema';

import { COLUMN_HEIGHT } from '@/constants/layout';
import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { getCullingRect, isTableVisible } from '@/konva/scene/viewport';

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
  point: Point
): ColumnDropTarget | null {
  const { collections, doc } = state;
  const cullingRect = getCullingRect(state);

  // Painted order, reversed: the row a pointer lands on belongs to whichever
  // table is drawn over the others there.
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .filter(table => isTableVisible(cullingRect, state, table))
    .sort((a, b) => b.ui.zIndex - a.ui.zIndex);

  for (const table of tables) {
    const rect = getTableRect(state, table);
    const inside =
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height;
    if (!inside) continue;

    const firstRowY = getColumnRect(state, table, 0).y;
    if (point.y < firstRowY) return null;

    const index = Math.floor((point.y - firstRowY) / COLUMN_HEIGHT);
    const columnId = table.columnIds[index];
    if (!columnId) return null;

    return { tableId: table.id, columnId, index };
  }

  return null;
}
