import type { CellRange, CellRef } from '@/model/types';
import type { SceneLayout, SceneRect } from '@/scene/layout';

/** The 1px edge every selected range draws. */
export const RANGE_BORDER = 1;

/** The 2px edge the active cell draws. */
export const ACTIVE_BORDER = 2;

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

/** The part of the content a cell region shows, in content pixels. */
export interface RegionView {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

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

/**
 * The k-rect of one range in one region, its 1px edge inside the range, cut to
 * the view plus the edge: a canvas takes a rect's size as a float, and a full
 * column is millions of pixels tall. The cut edges fall outside the clip.
 */
export function rangeBox(
  range: CellRange,
  view: RegionView,
  geometry: OverlayGeometry
): Readonly<OverlayBox> {
  const { offsets, rowHeight, rowCount } = geometry;
  const lastCol = offsets.length - 2;
  const endCol = Math.min(range.endCol, lastCol);
  const endRow = Math.min(range.endRow, rowCount - 1);

  if (range.startCol > endCol || range.startRow > endRow) return HIDDEN_BOX;

  const x0 = offsets[range.startCol];
  const x1 = offsets[endCol + 1];
  const y0 = range.startRow * rowHeight;
  const y1 = (endRow + 1) * rowHeight;

  if (
    x1 <= view.left ||
    x0 >= view.right ||
    y1 <= view.top ||
    y0 >= view.bottom
  ) {
    return HIDDEN_BOX;
  }

  const left = Math.max(x0, view.left - RANGE_BORDER);
  const right = Math.min(x1, view.right + RANGE_BORDER);
  const top = Math.max(y0, view.top - RANGE_BORDER);
  const bottom = Math.min(y1, view.bottom + RANGE_BORDER);
  const half = RANGE_BORDER / 2;

  return {
    visible: true,
    x: left + half,
    y: top + half,
    width: right - left - RANGE_BORDER,
    height: bottom - top - RANGE_BORDER,
  };
}

/**
 * The k-rect of the active cell, its 2px edge inside the cell, or hidden when
 * the cell is outside the grid, in the other region or out of view.
 */
export function activeBox(
  active: CellRef,
  frozen: boolean,
  frozenCount: number,
  view: RegionView,
  geometry: OverlayGeometry
): Readonly<OverlayBox> {
  const { offsets, rowHeight, rowCount } = geometry;
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

  const x0 = offsets[col];
  const x1 = offsets[col + 1];
  const y0 = row * rowHeight;

  if (
    x1 <= view.left ||
    x0 >= view.right ||
    y0 + rowHeight <= view.top ||
    y0 >= view.bottom
  ) {
    return HIDDEN_BOX;
  }

  const half = ACTIVE_BORDER / 2;

  return {
    visible: true,
    x: x0 + half,
    y: y0 + half,
    width: x1 - x0 - ACTIVE_BORDER,
    height: rowHeight - ACTIVE_BORDER,
  };
}
