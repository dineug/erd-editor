import { describe, expect, it } from 'vite-plus/test';

import { columnOffsets } from '@/model/columns';
import { computeLayout } from '@/scene/layout';
import {
  activeBox,
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
  it('puts the edge inside a range that is in view', () => {
    const box = rangeBox(
      { startRow: 21, startCol: 3, endRow: 22, endCol: 4 },
      view,
      geometry
    );

    expect(box).toEqual({
      visible: true,
      x: 300.5,
      y: 420.5,
      width: 199,
      height: 39,
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
      { startRow: 40, startCol: 0, endRow: 50, endCol: 9 },
      { startRow: 0, startCol: 0, endRow: 999, endCol: 1 },
      { startRow: 0, startCol: 6, endRow: 999, endCol: 9 },
    ]) {
      expect(rangeBox(range, view, geometry)).toBe(HIDDEN_BOX);
    }
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
      x: 800.5,
      y: 19_800.5,
      width: 199,
      height: 199,
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

describe('activeBox', () => {
  it('puts the 2px edge inside the active cell in its own region', () => {
    expect(activeBox({ row: 21, col: 3 }, false, 2, view, geometry)).toEqual({
      visible: true,
      x: 301,
      y: 421,
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

  it('hides the cell in the other region, outside the grid or out of view', () => {
    for (const [row, col, frozen] of [
      [21, 1, false],
      [21, 3, true],
      [-1, 3, false],
      [1000, 3, false],
      [21, -1, false],
      [21, 10, false],
      [19, 3, false],
      [40, 3, false],
      [21, 6, false],
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
