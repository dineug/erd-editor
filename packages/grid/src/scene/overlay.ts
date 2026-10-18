import type { CellRange, CellRef } from '@/model/types';
import type { SceneLayout, SceneRect } from '@/scene/layout';

/** The 1px edge every selected range draws. */
export const RANGE_BORDER = 1;

/** The 2px edge the active cell draws. */
export const ACTIVE_BORDER = 2;

/** The line each cell draws along its own right and bottom edges. */
const GRID_LINE = 1;

/** A k-rect's attributes, in the content coordinates of its region's scroll group. */
export interface OverlayBox {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * What one hidden box writes, the same whatever it stood for, so trading one
 * off-screen range for another writes nothing to its k-rect.
 */
export const HIDDEN_BOX: Readonly<OverlayBox> = Object.freeze({
  visible: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
});

/** The four fill boxes of a range that fills nothing in a region. */
const NO_FILL: readonly Readonly<OverlayBox>[] = Object.freeze([
  HIDDEN_BOX,
  HIDDEN_BOX,
  HIDDEN_BOX,
  HIDDEN_BOX,
]);

/** A rectangle of the content, in content pixels from left and top up to right and bottom. */
interface ContentRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The part of the content a cell region shows. */
export type RegionView = ContentRect;

/** What a range or the active cell is placed from. */
export interface OverlayGeometry {
  offsets: readonly number[];
  rowHeight: number;
  rowCount: number;
}

/** The content a region shows at the scroll offsets given; the frozen region never scrolls across. */
export function regionView(
  layout: SceneLayout,
  frozen: boolean,
  scrollTop: number,
  scrollLeft: number
): RegionView {
  const region: SceneRect = frozen ? layout.frozenBody : layout.body;
  const left = frozen ? 0 : layout.scrollOrigin + scrollLeft;

  return {
    left,
    top: scrollTop,
    right: left + region.width,
    bottom: scrollTop + region.height,
  };
}

/** A range held to the grid's last row and column, or null when it holds none of its cells. */
function heldRange(
  range: CellRange,
  geometry: OverlayGeometry
): CellRange | null {
  const endCol = Math.min(range.endCol, geometry.offsets.length - 2);
  const endRow = Math.min(range.endRow, geometry.rowCount - 1);

  if (range.startCol > endCol || range.startRow > endRow) return null;

  return { ...range, endRow, endCol };
}

/** The content pixels a range's cells cover, their own right and bottom lines included. */
function cellsRect(range: CellRange, geometry: OverlayGeometry): ContentRect {
  const { offsets, rowHeight } = geometry;

  return {
    left: offsets[range.startCol],
    top: range.startRow * rowHeight,
    right: offsets[range.endCol + 1],
    bottom: (range.endRow + 1) * rowHeight,
  };
}

const outOfView = (rect: ContentRect, view: RegionView) =>
  rect.right <= view.left ||
  rect.left >= view.right ||
  rect.bottom <= view.top ||
  rect.top >= view.bottom;

/**
 * The pixel a range's left or top edge draws on: the grid line of the cell
 * before, else its own first pixel where that line is the region's edge, out
 * of the clip, else the pixel before the view where the range is cut.
 */
function leadingEdge(start: number, viewStart: number): number {
  if (start > viewStart) return start - GRID_LINE;

  return start === viewStart ? start : viewStart - RANGE_BORDER;
}

/**
 * The k-rect of one range's 1px edge in one region, on the grid lines around
 * it and cut to the view plus the edge: a canvas takes a rect's size as a
 * float, and a full column is millions of pixels tall.
 */
export function rangeBox(
  range: CellRange,
  view: RegionView,
  geometry: OverlayGeometry
): Readonly<OverlayBox> {
  const held = heldRange(range, geometry);
  if (!held) return HIDDEN_BOX;

  const rect = cellsRect(held, geometry);
  if (outOfView(rect, view)) return HIDDEN_BOX;

  const left = leadingEdge(rect.left, view.left);
  const top = leadingEdge(rect.top, view.top);
  // The right and bottom edges draw on the range's own last lines, and a cut
  // one on the pixel past the view, outside the clip.
  const right = Math.min(rect.right, view.right + RANGE_BORDER);
  const bottom = Math.min(rect.bottom, view.bottom + RANGE_BORDER);
  const half = RANGE_BORDER / 2;

  return {
    visible: true,
    x: left + half,
    y: top + half,
    width: right - left - RANGE_BORDER,
    height: bottom - top - RANGE_BORDER,
  };
}

/** One fill box cut to the view, hidden when nothing of it is left. */
function fillBox(rect: ContentRect, view: RegionView): Readonly<OverlayBox> {
  const left = Math.max(rect.left, view.left);
  const top = Math.max(rect.top, view.top);
  const right = Math.min(rect.right, view.right);
  const bottom = Math.min(rect.bottom, view.bottom);

  if (right <= left || bottom <= top) return HIDDEN_BOX;

  return {
    visible: true,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * The selection fill of one range in one region, held to the grid and cut to
 * the view, as four boxes around the active cell, which a spreadsheet leaves
 * unfilled: above, below, left and right of it. A range without it fills one.
 */
export function fillBoxes(
  range: CellRange,
  active: CellRef,
  view: RegionView,
  geometry: OverlayGeometry
): readonly Readonly<OverlayBox>[] {
  const held = heldRange(range, geometry);
  if (!held) return NO_FILL;

  const rect = cellsRect(held, geometry);
  if (outOfView(rect, view)) return NO_FILL;

  const { row, col } = active;
  if (
    row < held.startRow ||
    row > held.endRow ||
    col < held.startCol ||
    col > held.endCol
  ) {
    return [fillBox(rect, view), HIDDEN_BOX, HIDDEN_BOX, HIDDEN_BOX];
  }

  const cell = cellsRect(
    { startRow: row, startCol: col, endRow: row, endCol: col },
    geometry
  );

  return [
    fillBox({ ...rect, bottom: cell.top }, view),
    fillBox({ ...rect, top: cell.bottom }, view),
    fillBox({ ...cell, left: rect.left, right: cell.left }, view),
    fillBox({ ...cell, left: cell.right, right: rect.right }, view),
  ];
}

/**
 * The k-rect of the active cell's 2px edge, on the grid lines around it and
 * the pixel inside each, or hidden when the cell is outside the grid, in the
 * other region or out of view.
 */
export function activeBox(
  active: CellRef,
  frozen: boolean,
  frozenCount: number,
  view: RegionView,
  geometry: OverlayGeometry
): Readonly<OverlayBox> {
  const { offsets, rowCount } = geometry;
  const { row, col } = active;

  if (
    row < 0 ||
    row >= rowCount ||
    col < 0 ||
    col >= offsets.length - 1 ||
    col < frozenCount !== frozen
  ) {
    return HIDDEN_BOX;
  }

  const cell = cellsRect(
    { startRow: row, startCol: col, endRow: row, endCol: col },
    geometry
  );
  if (outOfView(cell, view)) return HIDDEN_BOX;

  // The line before a cell that starts the view is the region's edge, out of
  // the clip, so the edge takes the cell's first two pixels there instead.
  const left = cell.left === view.left ? cell.left : cell.left - GRID_LINE;
  const top = cell.top === view.top ? cell.top : cell.top - GRID_LINE;
  const half = ACTIVE_BORDER / 2;

  return {
    visible: true,
    x: left + half,
    y: top + half,
    width: cell.right - left - ACTIVE_BORDER,
    height: cell.bottom - top - ACTIVE_BORDER,
  };
}
