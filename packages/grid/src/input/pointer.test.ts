// The pointer input's geometry on its own: what lies under a point, where a
// cell sits, the cell a drag past an edge extends to, and the edge scroll and
// wheel steps, against a scene state with the draw gate stood in for.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  AUTO_SCROLL_MAX,
  AUTO_SCROLL_MIN,
  autoScrollStep,
  blankAt,
  cellArea,
  cellNear,
  cellRect,
  columnAtX,
  edgeAtX,
  hitTest,
  regionOf,
  rowAtY,
  scrollsWithin,
  wheelScroll,
} from '@/input/pointer';
import type { ColumnDef } from '@/model/types';
import { createSceneState, type SceneInit } from '@/scene/state';

vi.mock('@dineug/r-html-konva', () => ({
  markDirty: vi.fn(),
  requestFlush: vi.fn(),
}));

const COLUMNS: ColumnDef[] = Array.from({ length: 30 }, (_, index) => ({
  id: `c${index}`,
  label: `${index}`,
}));

/**
 * A 900 by 560 scene, whose row-number header takes its 40px minimum here,
 * since happy-dom measures no digit: the cell area runs from x 40 and y 28
 * to the 12px scrollbar strips, 848 by 520.
 */
const create = (init: Partial<SceneInit> = {}) =>
  createSceneState({
    width: 900,
    height: 560,
    rowCount: 1000,
    columns: COLUMNS,
    getCell: () => '',
    ...init,
  });

describe('hitTest', () => {
  it('finds the corner, the headers, a cell and nothing outside the stage', () => {
    const { state } = create();

    expect(hitTest(state, { x: -1, y: 10 })).toEqual({ kind: 'none' });
    expect(hitTest(state, { x: 10, y: 900 })).toEqual({ kind: 'none' });
    expect(hitTest(state, { x: 10, y: 10 })).toEqual({ kind: 'corner' });
    expect(hitTest(state, { x: 10, y: 28 + 28 * 3 + 5 })).toEqual({
      kind: 'row',
      row: 3,
    });
    expect(hitTest(state, { x: 40 + 250, y: 10 })).toEqual({
      kind: 'column',
      col: 2,
    });
    expect(hitTest(state, { x: 40 + 240 + 2, y: 10 })).toEqual({
      kind: 'edge',
      col: 1,
    });
    expect(hitTest(state, { x: 40 + 250, y: 28 + 28 * 3 + 5 })).toEqual({
      kind: 'cell',
      row: 3,
      col: 2,
    });
  });

  it('hits nothing past the last row or the last column', () => {
    const { state } = create({ rowCount: 2, columns: COLUMNS.slice(0, 2) });

    expect(hitTest(state, { x: 10, y: 28 + 28 * 5 })).toEqual({ kind: 'none' });
    expect(hitTest(state, { x: 40 + 500, y: 10 })).toEqual({ kind: 'none' });
    expect(hitTest(state, { x: 40 + 500, y: 40 })).toEqual({ kind: 'none' });
  });

  it('finds a thumb along its length, and the track before or after it', () => {
    const scene = create();
    scene.setScroll(28 * 400, 1000);
    const { state } = scene;
    const { layout } = state;
    const vertical = { x: 900 - 6 };
    const horizontal = { y: 560 - 6 };

    expect(hitTest(state, { ...vertical, y: 29 })).toEqual({
      kind: 'track',
      axis: 'vertical',
      direction: -1,
    });
    expect(hitTest(state, { ...vertical, y: 559 - 12 })).toEqual({
      kind: 'track',
      axis: 'vertical',
      direction: 1,
    });

    const top = layout.body.y + ((520 - 24) * 28 * 400) / layout.maxScrollTop;
    expect(hitTest(state, { ...vertical, y: top + 2 })).toEqual({
      kind: 'thumb',
      axis: 'vertical',
    });

    expect(hitTest(state, { x: 45, ...horizontal })).toEqual({
      kind: 'track',
      axis: 'horizontal',
      direction: -1,
    });
    expect(hitTest(state, { x: 880, ...horizontal })).toEqual({
      kind: 'track',
      axis: 'horizontal',
      direction: 1,
    });
  });
});

describe('blankAt', () => {
  it('gives the row or the column a point past the last lies in, and nothing on a cell or off the cell area', () => {
    const { state } = create({ rowCount: 2, columns: COLUMNS.slice(0, 2) });
    const below = 28 + 28 * 5;

    expect(blankAt(state, { x: 40 + 130, y: below })).toEqual({
      row: null,
      col: 1,
    });
    expect(blankAt(state, { x: 40 + 500, y: 28 + 28 + 5 })).toEqual({
      row: 1,
      col: null,
    });
    expect(blankAt(state, { x: 40 + 500, y: below })).toEqual({
      row: null,
      col: null,
    });
    expect(blankAt(state, { x: 40 + 130, y: 28 + 5 })).toBeNull();
    expect(blankAt(state, { x: 40 + 500, y: 10 })).toBeNull();
    expect(blankAt(state, { x: 10, y: below })).toBeNull();
    expect(blankAt(state, { x: 40 + 130, y: 900 })).toBeNull();
  });

  it('takes the whole cell area of a grid with no row', () => {
    const { state } = create({ rowCount: 0 });

    expect(blankAt(state, { x: 40 + 130, y: 28 + 5 })).toEqual({
      row: null,
      col: 1,
    });
  });
});

describe('the columns and rows under a point', () => {
  it('reads the frozen columns unscrolled and the rest at the scroll offset', () => {
    const scene = create({ frozenColumns: 2 });
    scene.setScroll(28 * 10, 360);
    const { state } = scene;

    expect(columnAtX(state, 40 + 130)).toBe(1);
    expect(columnAtX(state, 40 + 240 + 10)).toBe(5);
    expect(columnAtX(state, 39)).toBe(-1);
    expect(columnAtX(state, 40 + 848)).toBe(-1);
    expect(rowAtY(state, 28 + 1)).toBe(10);
    expect(rowAtY(state, 27)).toBe(-1);
    expect(rowAtY(state, 28 + 520)).toBe(-1);
  });

  it('grabs a frozen edge among the frozen columns and a scrolled edge only where it shows', () => {
    const scene = create({ frozenColumns: 2 });
    const { state } = scene;

    expect(edgeAtX(state, 40 + 120 + 3)).toBe(0);
    expect(edgeAtX(state, 40 + 240 - 3)).toBe(1);
    expect(edgeAtX(state, 40 + 240 + 3)).toBe(1);
    expect(edgeAtX(state, 40 + 360 + 1)).toBe(2);
    expect(edgeAtX(state, 40 + 2)).toBe(-1);
    expect(edgeAtX(state, 40 + 60)).toBe(-1);

    // Column 2's right edge shows 2px right of the frozen boundary, so each
    // side of the boundary grabs the nearer of the two edges.
    scene.setScroll(0, 118);
    expect(edgeAtX(state, 40 + 239)).toBe(1);
    expect(edgeAtX(state, 40 + 241)).toBe(1);
    expect(edgeAtX(state, 40 + 244)).toBe(2);

    scene.setScroll(0, 122);
    expect(edgeAtX(state, 40 + 242)).toBe(1);
    expect(edgeAtX(state, 40 + 246)).toBe(-1);
    expect(edgeAtX(state, 900)).toBe(-1);
  });

  it('grabs no column edge past the cell area or under a scrolled-away column', () => {
    const scene = create();
    const { state } = scene;

    expect(edgeAtX(state, 40 + 848 + 5)).toBe(-1);
    // Column 0's right edge has scrolled 2px out past the cell area's left.
    scene.setScroll(0, 122);
    expect(edgeAtX(state, 40 + 1)).toBe(-1);
    expect(edgeAtX(state, 40 + 115)).toBe(1);
  });
});

describe('where a cell sits', () => {
  it('places a frozen cell from the frozen region and a scrolling one at the scroll offset', () => {
    const scene = create({ frozenColumns: 1 });
    scene.setScroll(28 * 4, 100);
    const { state } = scene;

    expect(cellRect(state, { row: 5, col: 0 })).toEqual({
      x: 40,
      y: 28 + 28,
      width: 120,
      height: 28,
    });
    expect(cellRect(state, { row: 5, col: 3 })).toEqual({
      x: 40 + 120 + 360 - 120 - 100,
      y: 28 + 28,
      width: 120,
      height: 28,
    });
    expect(regionOf(state, 0)).toBe(state.layout.frozenBody);
    expect(regionOf(state, 3)).toBe(state.layout.body);
    expect(cellArea(state)).toEqual({ x: 40, y: 28, width: 848, height: 520 });
  });

  it('gives a grid with no column a cell of no width', () => {
    const { state } = create({ columns: [] });

    expect(cellRect(state, { row: 0, col: 3 }).width).toBe(0);
  });
});

describe('cellNear', () => {
  it('holds a point past an edge to the cell area and the last row and column', () => {
    const scene = create({ rowCount: 5, columns: COLUMNS.slice(0, 3) });
    const { state } = scene;

    expect(cellNear(state, { x: -100, y: -100 })).toEqual({ row: 0, col: 0 });
    expect(cellNear(state, { x: 2000, y: 2000 })).toEqual({ row: 4, col: 2 });
    expect(cellNear(state, { x: 40 + 130, y: 28 + 30 })).toEqual({
      row: 1,
      col: 1,
    });
  });

  it('finds no cell in a grid with no rows, no columns or no room', () => {
    expect(
      cellNear(create({ rowCount: 0 }).state, { x: 50, y: 50 })
    ).toBeNull();
    expect(
      cellNear(create({ columns: [] }).state, { x: 50, y: 50 })
    ).toBeNull();
    expect(
      cellNear(create({ width: 30, height: 20 }).state, { x: 5, y: 5 })
    ).toBeNull();
  });
});

describe('autoScrollStep', () => {
  it('scrolls faster the farther past the edge, within its bounds and toward the edge', () => {
    expect(autoScrollStep(0)).toBe(0);
    expect(autoScrollStep(1)).toBe(AUTO_SCROLL_MIN + 1);
    expect(autoScrollStep(40)).toBe(AUTO_SCROLL_MIN + 20);
    expect(autoScrollStep(-40)).toBe(-(AUTO_SCROLL_MIN + 20));
    expect(autoScrollStep(10_000)).toBe(AUTO_SCROLL_MAX);
    expect(autoScrollStep(-10_000)).toBe(-AUTO_SCROLL_MAX);
  });
});

describe('wheelScroll', () => {
  const event = (init: Partial<WheelEvent>) => ({
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    shiftKey: false,
    ...init,
  });

  it('turns pixels, lines and pages into DOM pixels', () => {
    expect(wheelScroll(event({ deltaX: 3, deltaY: 10 }), 28, 500)).toEqual({
      left: 3,
      top: 10,
    });
    expect(wheelScroll(event({ deltaY: 2, deltaMode: 1 }), 28, 500)).toEqual({
      left: 0,
      top: 56,
    });
    expect(wheelScroll(event({ deltaY: -1, deltaMode: 2 }), 28, 500)).toEqual({
      left: 0,
      top: -500,
    });
  });

  it('scrolls a plain wheel across under Shift, and leaves a sideways one as it is', () => {
    expect(wheelScroll(event({ deltaY: 40, shiftKey: true }), 28, 500)).toEqual(
      {
        left: 40,
        top: 0,
      }
    );
    expect(
      wheelScroll(event({ deltaX: 5, deltaY: 40, shiftKey: true }), 28, 500)
    ).toEqual({ left: 5, top: 40 });
  });
});

describe('scrollsWithin', () => {
  /** An element that scrolls on the axes given, at its offsets in a range of 100px either way. */
  function scroller(overflow: string, top = 0, left = 0) {
    const element = document.createElement('div');
    element.style.overflowX = overflow;
    element.style.overflowY = overflow;
    // happy-dom computes a style only in the document and lays nothing out,
    // so the element joins the body and its scroll metrics are stood in.
    document.body.append(element);
    for (const [name, value] of Object.entries({
      scrollHeight: 200,
      clientHeight: 100,
      scrollWidth: 200,
      clientWidth: 100,
      scrollTop: top,
      scrollLeft: left,
    })) {
      Object.defineProperty(element, name, { value });
    }

    return element;
  }

  const slot = document.createElement('div');

  afterEach(() => document.body.replaceChildren());

  it('lets an element on the path that can still scroll that way keep the wheel', () => {
    const list = scroller('auto', 40);

    expect(scrollsWithin([list, slot], slot, { left: 0, top: 10 })).toBe(true);
    expect(scrollsWithin([list, slot], slot, { left: 0, top: -10 })).toBe(true);
    expect(
      scrollsWithin([scroller('scroll', 0, 30), slot], slot, {
        left: 10,
        top: 0,
      })
    ).toBe(true);
  });

  it('hands the wheel on from an element at its end, one that does not scroll, and anything past the boundary', () => {
    const atEnd = scroller('auto', 100);
    const atStart = scroller('auto', 0);

    expect(scrollsWithin([atEnd, slot], slot, { left: 0, top: 10 })).toBe(
      false
    );
    expect(scrollsWithin([atStart, slot], slot, { left: 0, top: -10 })).toBe(
      false
    );
    expect(
      scrollsWithin([scroller('visible', 40), slot], slot, {
        left: 0,
        top: 10,
      })
    ).toBe(false);
    expect(
      scrollsWithin([slot, scroller('auto', 40)], slot, { left: 0, top: 10 })
    ).toBe(false);
    expect(
      scrollsWithin([window, scroller('auto', 40)], slot, { left: 0, top: 0 })
    ).toBe(false);
  });
});
