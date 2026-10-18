import { describe, expect, it } from 'vite-plus/test';

import { columnOffsets } from '@/model/columns';
import { computeLayout } from '@/scene/layout';
import {
  activeBox,
  fillBoxes,
  HIDDEN_BOX,
  type OverlayGeometry,
  rangeBox,
  regionView,
} from '@/scene/overlay';

const offsets = columnOffsets(
  Array.from({ length: 10 }, (_, index) => ({
    id: `c${index}`,
    label: '',
    width: 100,
  }))
);

const geometry: OverlayGeometry = { offsets, rowHeight: 20, rowCount: 1000 };

const view = { left: 200, top: 400, right: 600, bottom: 800 };

describe('regionView', () => {
  const layout = computeLayout({
    width: 800,
    height: 600,
    rowCount: 1000,
    rowHeight: 20,
    offsets,
    frozenColumns: 2,
    digitWidth: 8,
  });

  it('starts the scrolling region at the first scrolling column plus the scroll', () => {
    expect(regionView(layout, false, 300, 50)).toEqual({
      left: 250,
      top: 300,
      right: 250 + layout.body.width,
      bottom: 300 + layout.body.height,
    });
  });

  it('keeps the frozen region at the content start across', () => {
    expect(regionView(layout, true, 300, 50)).toEqual({
      left: 0,
      top: 300,
      right: 200,
      bottom: 300 + layout.frozenBody.height,
    });
  });
});

describe('rangeBox', () => {
  it('puts the edge on the grid lines around a range that is in view', () => {
    const box = rangeBox(
      { startRow: 21, startCol: 3, endRow: 22, endCol: 4 },
      view,
      geometry
    );

    // The line before column 3 is pixel 299, column 4's own is pixel 499, and
    // a 1px stroke sits on a pixel from its middle.
    expect(box).toEqual({
      visible: true,
      x: 299.5,
      y: 419.5,
      width: 200,
      height: 40,
    });
  });

  it('keeps the left and top edges inside a range that starts at the view, where the line before is outside the clip', () => {
    const box = rangeBox(
      { startRow: 20, startCol: 2, endRow: 22, endCol: 4 },
      view,
      geometry
    );

    expect(box).toEqual({
      visible: true,
      x: 200.5,
      y: 400.5,
      width: 299,
      height: 59,
    });
  });

  it('cuts a range to the view plus its edge on every side', () => {
    const box = rangeBox(
      { startRow: 0, startCol: 0, endRow: 999, endCol: 9 },
      view,
      geometry
    );

    expect(box).toEqual({
      visible: true,
      x: 199.5,
      y: 399.5,
      width: 401,
      height: 401,
    });
  });

  it('hides a range wholly outside the view, the same box for any of them', () => {
    for (const range of [
      { startRow: 0, startCol: 0, endRow: 19, endCol: 9 },
      { startRow: 41, startCol: 0, endRow: 50, endCol: 9 },
      { startRow: 0, startCol: 0, endRow: 999, endCol: 1 },
      { startRow: 0, startCol: 7, endRow: 999, endCol: 9 },
    ]) {
      expect(rangeBox(range, view, geometry)).toBe(HIDDEN_BOX);
    }
  });

  it('draws the leading edge of a range that starts just past the view on the last line in it', () => {
    // Row 39's own bottom line is pixel 799 and column 5's right line pixel
    // 599, both inside a view that ends at 800 down and 600 across.
    expect(
      rangeBox(
        { startRow: 40, startCol: 0, endRow: 50, endCol: 9 },
        view,
        geometry
      )
    ).toEqual({ visible: true, x: 199.5, y: 799.5, width: 401, height: 1 });
    expect(
      rangeBox(
        { startRow: 0, startCol: 6, endRow: 999, endCol: 9 },
        view,
        geometry
      )
    ).toEqual({ visible: true, x: 599.5, y: 399.5, width: 1, height: 401 });
  });

  it('leaves the frozen region’s right edge to the frozen border, under a range that starts past it', () => {
    const frozenView = { ...view, left: 0, right: 600 };

    expect(
      rangeBox(
        { startRow: 0, startCol: 6, endRow: 999, endCol: 9 },
        frozenView,
        geometry,
        true
      )
    ).toBe(HIDDEN_BOX);
    expect(
      rangeBox(
        { startRow: 40, startCol: 0, endRow: 50, endCol: 9 },
        frozenView,
        geometry,
        true
      )
    ).toEqual({ visible: true, x: 0.5, y: 799.5, width: 600, height: 1 });
  });

  it('holds a range to the grid and hides one that starts past its end', () => {
    const wide = { left: 0, top: 0, right: 2000, bottom: 30_000 };

    expect(
      rangeBox(
        { startRow: 990, startCol: 8, endRow: 5000, endCol: 50 },
        wide,
        geometry
      )
    ).toEqual({
      visible: true,
      x: 799.5,
      y: 19_799.5,
      width: 200,
      height: 200,
    });
    expect(
      rangeBox(
        { startRow: 0, startCol: 10, endRow: 3, endCol: 12 },
        wide,
        geometry
      )
    ).toBe(HIDDEN_BOX);
    expect(
      rangeBox(
        { startRow: 1000, startCol: 0, endRow: 1003, endCol: 2 },
        wide,
        geometry
      )
    ).toBe(HIDDEN_BOX);
  });
});

describe('fillBoxes', () => {
  it('fills a range without the active cell with its first box, cut to the view', () => {
    expect(
      fillBoxes(
        { startRow: 10, startCol: 3, endRow: 22, endCol: 4 },
        { row: 0, col: 0 },
        view,
        geometry
      )
    ).toEqual([
      { visible: true, x: 300, y: 400, width: 200, height: 60 },
      HIDDEN_BOX,
      HIDDEN_BOX,
      HIDDEN_BOX,
    ]);
  });

  it('leaves the active cell out, filling above, below, left and right of it', () => {
    expect(
      fillBoxes(
        { startRow: 21, startCol: 2, endRow: 24, endCol: 4 },
        { row: 22, col: 3 },
        view,
        geometry
      )
    ).toEqual([
      { visible: true, x: 200, y: 420, width: 300, height: 20 },
      { visible: true, x: 200, y: 460, width: 300, height: 40 },
      { visible: true, x: 200, y: 440, width: 100, height: 20 },
      { visible: true, x: 400, y: 440, width: 100, height: 20 },
    ]);
  });

  it('fills nothing for a range that is only the active cell', () => {
    expect(
      fillBoxes(
        { startRow: 22, startCol: 3, endRow: 22, endCol: 3 },
        { row: 22, col: 3 },
        view,
        geometry
      ).every(box => box === HIDDEN_BOX)
    ).toBe(true);
  });

  it('fills nothing for a range out of view or past the grid', () => {
    for (const range of [
      { startRow: 0, startCol: 0, endRow: 19, endCol: 9 },
      { startRow: 1000, startCol: 0, endRow: 1003, endCol: 2 },
    ]) {
      expect(
        fillBoxes(range, { row: 0, col: 0 }, view, geometry).every(
          box => box === HIDDEN_BOX
        )
      ).toBe(true);
    }
  });
});

describe('activeBox', () => {
  it('puts the 2px edge on the grid lines around the active cell and the pixel inside each', () => {
    expect(activeBox({ row: 21, col: 3 }, false, 2, view, geometry)).toEqual({
      visible: true,
      x: 300,
      y: 420,
      width: 99,
      height: 19,
    });
    expect(activeBox({ row: 20, col: 2 }, false, 2, view, geometry)).toEqual({
      visible: true,
      x: 201,
      y: 401,
      width: 98,
      height: 18,
    });
    expect(
      activeBox(
        { row: 21, col: 1 },
        true,
        2,
        { ...view, left: 0, right: 200 },
        geometry
      ).visible
    ).toBe(true);
  });

  it('draws the edge of a cell just past the view on the last line in it', () => {
    expect(activeBox({ row: 40, col: 3 }, false, 2, view, geometry)).toEqual({
      visible: true,
      x: 300,
      y: 800,
      width: 99,
      height: 19,
    });
    expect(activeBox({ row: 21, col: 6 }, false, 2, view, geometry)).toEqual({
      visible: true,
      x: 600,
      y: 420,
      width: 99,
      height: 19,
    });
  });

  it('hides the cell in the other region, outside the grid or out of view', () => {
    for (const [row, col, frozen] of [
      [21, 1, false],
      [21, 3, true],
      [-1, 3, false],
      [1000, 3, false],
      [21, -1, false],
      [21, 10, false],
      [19, 3, false],
      [41, 3, false],
      [21, 7, false],
    ] as const) {
      expect(activeBox({ row, col }, frozen, 2, view, geometry)).toBe(
        HIDDEN_BOX
      );
    }
    expect(
      activeBox({ row: 21, col: 2 }, false, 0, view, geometry).visible
    ).toBe(true);
    expect(activeBox({ row: 21, col: 1 }, false, 0, view, geometry)).toBe(
      HIDDEN_BOX
    );
  });
});
