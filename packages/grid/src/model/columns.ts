import type { ColumnDef } from '@/model/types';

/** The width a column gets when its definition names none, in CSS pixels. */
export const DEFAULT_COLUMN_WIDTH = 120;

/** The narrowest a column draws or resizes to, in CSS pixels. */
export const MIN_COLUMN_WIDTH = 24;

/** How far either side of a column's right edge the pointer still grabs it. */
export const RESIZE_TOLERANCE = 4;

/**
 * A width held to the minimum. One that is not a finite number, such as a
 * corrupted stored setting, takes the fallback instead, since a NaN would
 * carry into every offset after its column.
 */
export function clampColumnWidth(
  width: number,
  fallback = DEFAULT_COLUMN_WIDTH
): number {
  return Number.isFinite(width) ? Math.max(MIN_COLUMN_WIDTH, width) : fallback;
}

/**
 * The left edge of every column and, last, the right edge of the last one:
 * offsets[i] is where column i starts, so the array is one longer than the
 * columns and offsets[columns.length] is the width of them all.
 */
export function columnOffsets(
  columns: readonly ColumnDef[],
  defaultWidth = DEFAULT_COLUMN_WIDTH
): number[] {
  const fallback = clampColumnWidth(defaultWidth);
  const offsets = new Array<number>(columns.length + 1);
  offsets[0] = 0;

  for (let i = 0; i < columns.length; i++) {
    const { width } = columns[i];
    offsets[i + 1] =
      offsets[i] +
      (width === undefined ? fallback : clampColumnWidth(width, fallback));
  }

  return offsets;
}

/** The last index whose offset is at or left of x, or -1 when x is left of them all. */
function floorIndex(offsets: readonly number[], x: number): number {
  if (!(x >= offsets[0])) return -1;

  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;

    if (offsets[middle] <= x) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

/** The column under x, measured from the first column's left edge, or -1 outside them all. */
export function columnAt(offsets: readonly number[], x: number): number {
  const count = offsets.length - 1;

  if (count < 1 || !(x < offsets[count])) return -1;

  return floorIndex(offsets, x);
}

/**
 * The column whose right edge lies within the tolerance of x, the nearest one
 * when two do, or -1. The first column's left edge resizes nothing, so x
 * near it alone finds no column.
 */
export function resizeEdgeAt(
  offsets: readonly number[],
  x: number,
  tolerance = RESIZE_TOLERANCE
): number {
  const count = offsets.length - 1;

  if (count < 1) return -1;

  const index = Math.min(count, Math.max(0, floorIndex(offsets, x)));
  const leftDistance = index > 0 ? Math.abs(x - offsets[index]) : Infinity;
  const rightDistance =
    index < count ? Math.abs(offsets[index + 1] - x) : Infinity;

  if (leftDistance <= rightDistance) {
    return leftDistance <= tolerance ? index - 1 : -1;
  }

  return rightDistance <= tolerance ? index : -1;
}
