import { query } from '@dineug/erd-editor-schema';
import { isEqual } from 'es-toolkit';

import { TABLE_PADDING } from '@/constants/layout';
import type { DraggableColumn } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { getColumnRect, getTableRect, type Rect } from '@/konva/scene/metrics';
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
 * How far under a card's bottom edge a drop still appends to it. A card ends
 * at its last row, so the padding it used to keep under them is kept here.
 */
const APPEND_BAND = TABLE_PADDING;

/**
 * The row a column drag would drop on, in canvas coordinates, or null over a
 * header and over bare canvas. A drop appends in a band under a card and
 * anywhere on a table with no rows. Arithmetic, never a hit canvas read.
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
  const cards = tables.map(table => ({
    table,
    rect: getTableRect(state, table, source),
  }));
  const within = (rect: Rect, band: number) =>
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height + band;

  // A card under the pointer outranks the band under another one.
  const card =
    cards.find(({ rect }) => within(rect, 0)) ??
    cards.find(({ rect }) => within(rect, APPEND_BAND));
  if (!card) return null;

  const { table } = card;
  const columnIds = getVisibleColumnIds(state, table, source);
  const append = { tableId: table.id, columnId: null, index: columnIds.length };
  if (!columnIds.length) return append;

  const firstRow = getColumnRect(state, table, 0, source);
  if (point.y < firstRow.y) return null;

  const index = Math.floor((point.y - firstRow.y) / firstRow.height);
  if (index >= columnIds.length) return append;

  return { tableId: table.id, columnId: columnIds[index], index };
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
