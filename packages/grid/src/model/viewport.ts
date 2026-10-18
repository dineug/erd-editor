import { columnAt } from '@/model/columns';

/** The height of every row, and of the column header, when the host names none. */
export const DEFAULT_ROW_HEIGHT = 28;

/**
 * The tallest the DOM scroll spacer grows before the grid scales its scroll
 * range, well under the roughly 33,550,000 px a layout in Chrome can hold.
 */
export const SCROLL_HEIGHT_CAP = 8_000_000;

/** The narrowest the row-number header draws, in CSS pixels. */
export const ROW_HEADER_MIN_WIDTH = 40;

/** The room around the widest row number, both sides together. */
export const ROW_HEADER_PADDING = 16;

/** How many rows and columns past each edge of the view a frame also draws. */
export interface Overscan {
  rows: number;
  cols: number;
}

/** Two rows above and below the view and one column either side of it. */
export const DEFAULT_OVERSCAN: Readonly<Overscan> = Object.freeze({
  rows: 2,
  cols: 1,
});

/**
 * The cell area a frame shows, right of the row-number header and below the
 * column header, frozen columns included, with the rows it shows them from
 * and how many leading columns stay put while the rest scroll.
 */
export interface ViewportSize {
  width: number;
  height: number;
  rowCount: number;
  frozenColumns?: number;
}

/**
 * The cells a frame draws, every end inclusive and an end one short of its
 * start when nothing is in view. Columns 0 to frozenEnd stay fixed, and the
 * scrolling ones, colStart to colEnd, never start before the frozen ones end.
 */
export interface VisibleRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  frozenEnd: number;
}

/** The row under a content offset y, or -1 above the first row or past the last. */
export function rowAt(y: number, rowHeight: number, rowCount: number): number {
  if (!(y >= 0) || !(rowHeight > 0)) return -1;

  const row = Math.floor(y / rowHeight);

  return row < rowCount ? row : -1;
}

/** How many leading columns are frozen, held to the columns there are. */
export function frozenCount(
  offsets: readonly number[],
  frozenColumns = 0
): number {
  const count = Math.max(0, offsets.length - 1);

  return Math.min(count, Math.max(0, Math.floor(frozenColumns) || 0));
}

/** How wide the frozen columns are together, from the first column's left edge. */
export function frozenWidth(
  offsets: readonly number[],
  frozenColumns = 0
): number {
  return offsets[frozenCount(offsets, frozenColumns)] ?? 0;
}

/** The last column whose left edge lies strictly left of x, or -1 when none does. */
function lastColumnBefore(offsets: readonly number[], x: number): number {
  const count = offsets.length - 1;

  if (count < 1 || !(x > offsets[0])) return -1;
  if (x > offsets[count - 1]) return count - 1;

  const column = columnAt(offsets, x);

  return offsets[column] === x ? column - 1 : column;
}

/**
 * The rows and columns a frame draws. scrollTop is the content offset that
 * scrollMapping's toContent gives, not the DOM scrollTop, and scrollLeft is
 * the DOM scrollLeft, which no cap scales.
 */
export function visibleRange(
  scrollTop: number,
  scrollLeft: number,
  size: ViewportSize,
  rowHeight: number,
  offsets: readonly number[],
  overscan: Readonly<Overscan> = DEFAULT_OVERSCAN
): VisibleRange {
  const { width, height, rowCount } = size;
  const count = Math.max(0, offsets.length - 1);
  const frozen = frozenCount(offsets, size.frozenColumns);
  const top = Math.max(0, scrollTop);
  const left = Math.max(0, scrollLeft);

  let rowStart = 0;
  let rowEnd = -1;

  if (rowCount > 0 && height > 0 && rowHeight > 0) {
    const firstRow = Math.floor(top / rowHeight);
    const lastRow = Math.ceil((top + height) / rowHeight) - 1;

    rowEnd = Math.min(rowCount - 1, lastRow + overscan.rows);
    rowStart = Math.min(rowEnd + 1, Math.max(0, firstRow - overscan.rows));
  }

  const frozenEnd = Math.min(frozen - 1, lastColumnBefore(offsets, width));
  const viewLeft = offsets[frozen] + left;
  const firstColumn = frozen < count ? columnAt(offsets, viewLeft) : -1;

  let colStart = frozen;
  let colEnd = frozen - 1;

  if (firstColumn >= 0 && width > offsets[frozen]) {
    colStart = Math.max(frozen, firstColumn - overscan.cols);
    colEnd = Math.min(
      count - 1,
      lastColumnBefore(offsets, left + width) + overscan.cols
    );
  }

  return { rowStart, rowEnd, colStart, colEnd, frozenEnd };
}

/**
 * How the DOM scroll range stands for the content's, scaled by one ratio once
 * the content outgrows the cap, so a resize moves no row. viewportHeight is
 * the height rows scroll in, below the column header.
 */
export interface ScrollMapping {
  /** Content pixels per DOM pixel: 1 up to the cap, the content height over the cap past it. */
  readonly ratio: number;
  /** How tall the spacer below the column header makes the DOM scroll range. */
  domHeight(viewportHeight: number): number;
  /** The content offset a DOM scrollTop shows, held between 0 and the last row's end. */
  toContent(domTop: number, viewportHeight: number): number;
  /** The DOM scrollTop that shows a content offset, toContent's inverse short of the last DOM pixel. */
  toDom(contentTop: number, viewportHeight: number): number;
}

/**
 * The mapping for content this tall. The spacer is a viewport taller than the
 * scaled content, so the last DOM scrollTop shows the last row, and the last
 * DOM pixel snaps to the content's end however the browser rounds the scroller.
 */
export function scrollMapping(
  contentHeight: number,
  cap = SCROLL_HEIGHT_CAP
): ScrollMapping {
  const height = Math.max(0, contentHeight);
  const ratio = height > cap ? height / cap : 1;
  const contentMax = (viewportHeight: number) =>
    Math.max(0, height - viewportHeight);

  return {
    ratio,
    domHeight: viewportHeight =>
      contentMax(viewportHeight) / ratio +
      Math.min(height, Math.max(0, viewportHeight)),
    toContent: (domTop, viewportHeight) => {
      const max = contentMax(viewportHeight);

      if (ratio > 1 && domTop >= max / ratio - 1) return max;

      return Math.min(max, Math.max(0, domTop * ratio));
    },
    toDom: (contentTop, viewportHeight) =>
      Math.min(contentMax(viewportHeight), Math.max(0, contentTop)) / ratio,
  };
}

/**
 * The row-number header's width: the digits of the last row number, rows
 * counting from 1, at the font's digit width plus the padding, whole pixels
 * so its edge lands on one, and never under the minimum.
 */
export function rowHeaderWidth(
  rowCount: number,
  digitWidth: number,
  padding = ROW_HEADER_PADDING
): number {
  const digits = String(Math.max(1, Math.floor(rowCount))).length;

  return Math.max(
    ROW_HEADER_MIN_WIDTH,
    Math.ceil(digits * digitWidth + padding)
  );
}
