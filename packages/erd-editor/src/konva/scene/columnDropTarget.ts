import { query } from '@dineug/erd-editor-schema';
import { isEqual } from 'es-toolkit';

import type { DraggableColumn } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { getVisibleColumnIds, getVisibleIds } from '@/konva/scene/viewLayout';
import { getCullingRect, isTableVisible } from '@/konva/scene/viewport';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

export type ColumnDropTarget = {
  tableId: string;
  /** The row dropped on, or null past the last one, where a drop appends. */
  columnId: string | null;
  index: number;
};

/**
 * The row a column drag would drop on, in canvas coordinates, or null over a
 * header and over bare canvas. Past the last row a drop appends, as it does
 * under the header of a table with none. Arithmetic, never a hit canvas read.
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

    const firstRow = getColumnRect(state, table, 0, source);
    if (point.y < firstRow.y) return null;

    const index = Math.floor((point.y - firstRow.y) / firstRow.height);
    const columnIds = getVisibleColumnIds(state, table, source);
    if (index >= columnIds.length) {
      return { tableId: table.id, columnId: null, index: columnIds.length };
    }

    return { tableId: table.id, columnId: columnIds[index], index };
  }

  return null;
}

/**
 * Whether a drop leaves the order as it stands: over a row the drag carries,
 * or past the end of the table whose last rows are already the dragged ones.
 */
export function isDropInPlace(
  { collections }: RootState,
  { tableId, columnIds }: DraggableColumn,
  target: ColumnDropTarget
): boolean {
  if (target.columnId !== null) return columnIds.includes(target.columnId);
  if (target.tableId !== tableId) return false;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(tableId);

  return isEqual(table?.columnIds.slice(-columnIds.length), columnIds);
}
