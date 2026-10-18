import { frozenCount, rowHeaderWidth } from '@/model/viewport';

/**
 * How thick each Konva scrollbar is. The strip it runs in is kept out of the
 * cell area, as a native scrollbar would be, so the last row and the last
 * column scroll fully into view beside it.
 */
export const SCROLLBAR_SIZE = 12;

/** A rectangle on the stage, in CSS pixels from its top-left corner. */
export interface SceneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the regions of a grid are placed from. */
export interface LayoutInput {
  /** The stage's size. */
  width: number;
  height: number;
  rowCount: number;
  rowHeight: number;
  /** columnOffsets of the columns as drawn, a resize drag's width included. */
  offsets: readonly number[];
  frozenColumns: number;
  /** The widest digit of the font, which sizes the row-number header. */
  digitWidth: number;
}

/**
 * Where each region of the grid sits on the stage, and the scroll range the
 * cell area has. The column header is one row tall, and the frozen regions
 * hold the frozen columns that fit in the cell area.
 */
export interface SceneLayout {
  width: number;
  height: number;
  headerHeight: number;
  rowHeaderWidth: number;
  /** The cell area, right of the row-number header and below the column header, short of each scrollbar strip. */
  cellWidth: number;
  cellHeight: number;
  /** How many leading columns stay put while the rest scroll. */
  frozenCount: number;
  /** How much of the cell area's width the frozen columns take. */
  frozenWidth: number;
  /** The left edge of the first scrolling column, in content pixels. */
  scrollOrigin: number;
  contentWidth: number;
  contentHeight: number;
  maxScrollTop: number;
  maxScrollLeft: number;
  verticalBar: boolean;
  horizontalBar: boolean;
  corner: SceneRect;
  columnHeader: SceneRect;
  frozenHeader: SceneRect;
  rowHeader: SceneRect;
  frozenBody: SceneRect;
  body: SceneRect;
}

const rect = (
  x: number,
  y: number,
  width: number,
  height: number
): SceneRect => ({
  x,
  y,
  width: Math.max(0, width),
  height: Math.max(0, height),
});

/**
 * The regions for a stage of the size given. A scrollbar shows on an axis
 * whose content outgrows the cell area, the horizontal one only while a column
 * is left to scroll across, and taking its strip can make the other need one.
 */
export function computeLayout(input: LayoutInput): SceneLayout {
  const { width, height, rowHeight, offsets } = input;
  const rowCount = Math.max(0, Math.floor(input.rowCount) || 0);
  const headerHeight = rowHeight;
  const headerWidth = rowHeaderWidth(rowCount, input.digitWidth);
  const contentWidth = offsets[offsets.length - 1] ?? 0;
  const contentHeight = rowCount * rowHeight;
  const frozen = frozenCount(offsets, input.frozenColumns);
  const scrollOrigin = offsets[frozen] ?? 0;

  let verticalBar = false;
  let horizontalBar = false;
  let cellWidth = 0;
  let cellHeight = 0;

  // A bar only ever appears here, so the flags settle within three passes.
  for (;;) {
    cellWidth = Math.max(
      0,
      width - headerWidth - (verticalBar ? SCROLLBAR_SIZE : 0)
    );
    cellHeight = Math.max(
      0,
      height - headerHeight - (horizontalBar ? SCROLLBAR_SIZE : 0)
    );

    const vertical = contentHeight > cellHeight;
    const horizontal = contentWidth > cellWidth;
    if (vertical === verticalBar && horizontal === horizontalBar) break;

    verticalBar = vertical;
    horizontalBar = horizontal;
  }

  // Frozen columns that fill the cell area leave no column to scroll across,
  // so the bar goes and its strip is given back to the rows. The vertical bar
  // stays as settled: dropping it could hand the frozen columns room again.
  if (horizontalBar && scrollOrigin >= cellWidth) {
    horizontalBar = false;
    cellHeight = Math.max(0, height - headerHeight);
  }

  const frozenWidth = Math.min(scrollOrigin, cellWidth);
  const scrollingWidth = cellWidth - frozenWidth;

  return {
    width,
    height,
    headerHeight,
    rowHeaderWidth: headerWidth,
    cellWidth,
    cellHeight,
    frozenCount: frozen,
    frozenWidth,
    scrollOrigin,
    contentWidth,
    contentHeight,
    maxScrollTop: Math.max(0, contentHeight - cellHeight),
    maxScrollLeft: horizontalBar ? contentWidth - cellWidth : 0,
    verticalBar,
    horizontalBar,
    corner: rect(0, 0, headerWidth, headerHeight),
    columnHeader: rect(
      headerWidth + frozenWidth,
      0,
      scrollingWidth,
      headerHeight
    ),
    frozenHeader: rect(headerWidth, 0, frozenWidth, headerHeight),
    rowHeader: rect(0, headerHeight, headerWidth, cellHeight),
    frozenBody: rect(headerWidth, headerHeight, frozenWidth, cellHeight),
    body: rect(
      headerWidth + frozenWidth,
      headerHeight,
      scrollingWidth,
      cellHeight
    ),
  };
}
