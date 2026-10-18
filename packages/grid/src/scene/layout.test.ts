import { describe, expect, it } from 'vite-plus/test';

import { columnOffsets } from '@/model/columns';
import {
  computeLayout,
  type LayoutInput,
  SCROLLBAR_SIZE,
} from '@/scene/layout';

const columns = (count: number, width = 100) =>
  Array.from({ length: count }, (_, index) => ({
    id: `c${index}`,
    label: `${index}`,
    width,
  }));

const input = (overrides: Partial<LayoutInput> = {}): LayoutInput => ({
  width: 800,
  height: 600,
  rowCount: 1000,
  rowHeight: 28,
  offsets: columnOffsets(columns(30)),
  frozenColumns: 2,
  digitWidth: 8,
  ...overrides,
});

describe('computeLayout', () => {
  it('places the six regions around the row-number header and the frozen columns', () => {
    const layout = computeLayout(input());
    // Four digits at 8px plus the padding.
    const header = 48;

    expect(layout.rowHeaderWidth).toBe(header);
    expect(layout.headerHeight).toBe(28);
    expect(layout.verticalBar && layout.horizontalBar).toBe(true);
    expect(layout.cellWidth).toBe(800 - header - SCROLLBAR_SIZE);
    expect(layout.cellHeight).toBe(600 - 28 - SCROLLBAR_SIZE);
    expect(layout.frozenCount).toBe(2);
    expect(layout.frozenWidth).toBe(200);
    expect(layout.scrollOrigin).toBe(200);
    expect(layout.corner).toEqual({ x: 0, y: 0, width: header, height: 28 });
    expect(layout.frozenHeader).toEqual({
      x: header,
      y: 0,
      width: 200,
      height: 28,
    });
    expect(layout.columnHeader).toEqual({
      x: header + 200,
      y: 0,
      width: layout.cellWidth - 200,
      height: 28,
    });
    expect(layout.rowHeader).toEqual({
      x: 0,
      y: 28,
      width: header,
      height: layout.cellHeight,
    });
    expect(layout.frozenBody).toEqual({
      x: header,
      y: 28,
      width: 200,
      height: layout.cellHeight,
    });
    expect(layout.body).toEqual({
      x: header + 200,
      y: 28,
      width: layout.cellWidth - 200,
      height: layout.cellHeight,
    });
  });

  it('measures the scroll range from the content past the cell area', () => {
    const layout = computeLayout(input());

    expect(layout.contentWidth).toBe(3000);
    expect(layout.contentHeight).toBe(28_000);
    expect(layout.maxScrollTop).toBe(28_000 - layout.cellHeight);
    expect(layout.maxScrollLeft).toBe(3000 - layout.cellWidth);
  });

  it('shows no scrollbar for content that fits', () => {
    const layout = computeLayout(
      input({ rowCount: 5, offsets: columnOffsets(columns(3)) })
    );

    expect(layout.verticalBar || layout.horizontalBar).toBe(false);
    expect(layout.cellWidth).toBe(800 - 40);
    expect(layout.maxScrollTop).toBe(0);
    expect(layout.maxScrollLeft).toBe(0);
  });

  it('shows the second bar when the first one takes the room the content fitted in', () => {
    // Twenty rows fill the cell area exactly until the horizontal strip
    // takes its 12px, and the vertical strip then follows.
    const layout = computeLayout(
      input({ height: 28 + 20 * 28, rowCount: 20, frozenColumns: 0 })
    );

    expect(layout.horizontalBar).toBe(true);
    expect(layout.verticalBar).toBe(true);
    expect(layout.cellHeight).toBe(20 * 28 - SCROLLBAR_SIZE);
  });

  it('cuts frozen columns wider than the cell area, leaving the scrolling region empty and nothing to scroll across', () => {
    const layout = computeLayout(input({ width: 250, frozenColumns: 5 }));

    expect(layout.frozenWidth).toBe(layout.cellWidth);
    expect(layout.scrollOrigin).toBe(500);
    expect(layout.body.width).toBe(0);
    expect(layout.columnHeader.width).toBe(0);
    expect(layout.horizontalBar).toBe(false);
    expect(layout.maxScrollLeft).toBe(0);
    expect(layout.verticalBar).toBe(true);
    expect(layout.cellHeight).toBe(600 - 28);
  });

  it('drops the horizontal bar when every column is frozen and the frozen ones overflow', () => {
    const layout = computeLayout(
      input({ width: 400, rowCount: 5, frozenColumns: 30 })
    );

    expect(layout.scrollOrigin).toBe(layout.contentWidth);
    expect(layout.horizontalBar).toBe(false);
    expect(layout.verticalBar).toBe(false);
    expect(layout.maxScrollLeft).toBe(0);
    expect(layout.cellHeight).toBe(600 - 28);
  });

  it('keeps the vertical bar it settled when the frozen columns fill the area only beside it', () => {
    // Fifty rows fit under the header, not above the horizontal strip too, and
    // the 200px of frozen columns fit beside the 40px of row numbers only
    // without the vertical strip.
    const layout = computeLayout(
      input({ width: 40 + 205, height: 28 + 50 * 28 + 6, rowCount: 50 })
    );

    expect(layout.rowHeaderWidth).toBe(40);
    expect(layout.verticalBar).toBe(true);
    expect(layout.horizontalBar).toBe(false);
    expect(layout.cellWidth).toBe(205 - SCROLLBAR_SIZE);
    expect(layout.frozenWidth).toBe(layout.cellWidth);
    expect(layout.maxScrollLeft).toBe(0);
    expect(layout.maxScrollTop).toBe(0);
  });

  it('holds a stage too small for the headers, no columns and no rows to empty regions', () => {
    const layout = computeLayout(
      input({ width: 10, height: 10, rowCount: Number.NaN, offsets: [0] })
    );

    expect(layout.cellWidth).toBe(0);
    expect(layout.cellHeight).toBe(0);
    expect(layout.contentWidth).toBe(0);
    expect(layout.contentHeight).toBe(0);
    expect(layout.frozenCount).toBe(0);
    expect(layout.body).toEqual({ x: 40, y: 28, width: 0, height: 0 });
    expect(layout.verticalBar || layout.horizontalBar).toBe(false);
  });

  it('reads the content width off an empty offsets list as nothing', () => {
    expect(computeLayout(input({ offsets: [] })).contentWidth).toBe(0);
  });
});
