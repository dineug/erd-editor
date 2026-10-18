import { describe, expect, it } from 'vite-plus/test';

import {
  clampColumnWidth,
  columnAt,
  columnOffsets,
  DEFAULT_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  RESIZE_TOLERANCE,
  resizeEdgeAt,
} from '@/model/columns';
import type { ColumnDef } from '@/model/types';

/** Columns named a, b, c and so on, one per width; undefined leaves a width unset. */
function columns(...widths: Array<number | undefined>): ColumnDef[] {
  return widths.map((width, index) => ({
    id: String.fromCharCode(97 + index),
    label: String.fromCharCode(65 + index),
    ...(width === undefined ? {} : { width }),
  }));
}

describe('clampColumnWidth', () => {
  it('holds a width to the minimum and keeps a wider one as it is', () => {
    expect(MIN_COLUMN_WIDTH).toBe(24);
    expect(clampColumnWidth(10)).toBe(24);
    expect(clampColumnWidth(-50)).toBe(24);
    expect(clampColumnWidth(24)).toBe(24);
    expect(clampColumnWidth(80.5)).toBe(80.5);
  });

  it('takes the fallback for a width that is not a finite number', () => {
    expect(clampColumnWidth(Number.NaN)).toBe(DEFAULT_COLUMN_WIDTH);
    expect(clampColumnWidth(Number.POSITIVE_INFINITY, 64)).toBe(64);
  });
});

describe('columnOffsets', () => {
  it('sums the widths into left edges, the total width last', () => {
    expect(columnOffsets(columns(100, 50, 200))).toEqual([0, 100, 150, 350]);
  });

  it('gives a column with no width the default of 120', () => {
    expect(DEFAULT_COLUMN_WIDTH).toBe(120);
    expect(columnOffsets(columns(undefined, 30, undefined))).toEqual([
      0, 120, 150, 270,
    ]);
    expect(columnOffsets(columns(undefined, 30), 60)).toEqual([0, 60, 90]);
  });

  it('holds a narrow width and a narrow default alike to the minimum', () => {
    expect(columnOffsets(columns(5, undefined), 1)).toEqual([0, 24, 48]);
  });

  it('carries no NaN past a column whose width is not a number', () => {
    expect(columnOffsets(columns(100, Number.NaN, 100), 80)).toEqual([
      0, 100, 180, 280,
    ]);
  });

  it('answers a grid with no columns with the one zero edge', () => {
    expect(columnOffsets([])).toEqual([0]);
  });
});

describe('columnAt', () => {
  const offsets = columnOffsets(columns(100, 50, 200));

  it('finds the column whose span holds x, its left edge in and right edge out', () => {
    expect(columnAt(offsets, 0)).toBe(0);
    expect(columnAt(offsets, 99.9)).toBe(0);
    expect(columnAt(offsets, 100)).toBe(1);
    expect(columnAt(offsets, 149)).toBe(1);
    expect(columnAt(offsets, 150)).toBe(2);
    expect(columnAt(offsets, 349.5)).toBe(2);
  });

  it('answers -1 left of the first column and from the last right edge on', () => {
    expect(columnAt(offsets, -0.1)).toBe(-1);
    expect(columnAt(offsets, 350)).toBe(-1);
    expect(columnAt(offsets, 10_000)).toBe(-1);
    expect(columnAt(offsets, Number.NaN)).toBe(-1);
  });

  it('answers -1 for a grid with no columns', () => {
    expect(columnAt(columnOffsets([]), 0)).toBe(-1);
    expect(columnAt([], 0)).toBe(-1);
  });

  it('agrees with a linear scan over a thousand columns', () => {
    const widths = Array.from({ length: 1000 }, (_, i) => 24 + ((i * 37) % 90));
    const many = columnOffsets(columns(...widths));

    for (let x = 0; x < many[1000]; x += 17) {
      const expected = many.findIndex(
        (left, i) => left <= x && x < many[i + 1]
      );
      expect(columnAt(many, x)).toBe(expected);
    }
  });
});

describe('resizeEdgeAt', () => {
  const offsets = columnOffsets(columns(100, 50, 200));

  it('grabs a column by its right edge within 4 px either side', () => {
    expect(RESIZE_TOLERANCE).toBe(4);
    expect(resizeEdgeAt(offsets, 100)).toBe(0);
    expect(resizeEdgeAt(offsets, 96)).toBe(0);
    expect(resizeEdgeAt(offsets, 104)).toBe(0);
    expect(resizeEdgeAt(offsets, 147)).toBe(1);
    expect(resizeEdgeAt(offsets, 153)).toBe(1);
  });

  it('grabs the last column past its right edge, where no column follows', () => {
    expect(resizeEdgeAt(offsets, 352)).toBe(2);
    expect(resizeEdgeAt(offsets, 354)).toBe(2);
  });

  it('answers -1 away from every edge and near the first left edge', () => {
    expect(resizeEdgeAt(offsets, 95.9)).toBe(-1);
    expect(resizeEdgeAt(offsets, 125)).toBe(-1);
    expect(resizeEdgeAt(offsets, 354.1)).toBe(-1);
    expect(resizeEdgeAt(offsets, 0)).toBe(-1);
    expect(resizeEdgeAt(offsets, 2)).toBe(-1);
    expect(resizeEdgeAt(offsets, -3)).toBe(-1);
    expect(resizeEdgeAt(offsets, Number.NaN)).toBe(-1);
  });

  it('takes the nearer of two edges a wide tolerance reaches, the left on a tie', () => {
    const narrow = columnOffsets(columns(24, 24, 24));

    expect(resizeEdgeAt(narrow, 30, 20)).toBe(0);
    expect(resizeEdgeAt(narrow, 40, 20)).toBe(1);
    expect(resizeEdgeAt(narrow, 36, 20)).toBe(0);
  });

  it('honours a tolerance it is given', () => {
    expect(resizeEdgeAt(offsets, 108, 8)).toBe(0);
    expect(resizeEdgeAt(offsets, 101, 0)).toBe(-1);
    expect(resizeEdgeAt(offsets, 100, 0)).toBe(0);
  });

  it('answers -1 for a grid with no columns', () => {
    expect(resizeEdgeAt(columnOffsets([]), 0)).toBe(-1);
  });
});
