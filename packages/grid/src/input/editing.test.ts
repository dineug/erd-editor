// Where an editor sits over its cell, read off a scene state with the draw
// gate stood in for: inside its cell, cut to the region it shows in, or held
// inside the cell area once its cell has left the view.

import { describe, expect, it, vi } from 'vite-plus/test';

import { holdInside, NO_INSETS, placeEditor } from '@/input/editing';
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
 * A 900 by 560 scene with the 40px row-number header happy-dom leaves it,
 * since it measures no digit: the cell area runs from x 40 and y 28 to the
 * 12px scrollbar strips, 848 by 520.
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

const INSETS = { left: 1, top: 1, right: 2, bottom: 2 };

describe('holdInside', () => {
  it('moves a rectangle into an area, cutting it only where it is the larger', () => {
    const area = { x: 40, y: 28, width: 848, height: 520 };

    expect(holdInside({ x: 0, y: -900, width: 120, height: 28 }, area)).toEqual(
      { x: 40, y: 28, width: 120, height: 28 }
    );
    expect(
      holdInside({ x: 2000, y: 9000, width: 120, height: 28 }, area)
    ).toEqual({ x: 768, y: 520, width: 120, height: 28 });
    expect(holdInside({ x: 0, y: 0, width: 2000, height: 28 }, area)).toEqual({
      x: 40,
      y: 28,
      width: 848,
      height: 28,
    });
  });
});

describe('placeEditor', () => {
  it('sits inside a cell in view whole, with no clip', () => {
    const { state } = create();

    expect(placeEditor(state, { row: 2, col: 1 }, INSETS)).toEqual({
      box: { x: 40 + 120 + 1, y: 28 + 56 + 1, width: 117, height: 25 },
      clip: null,
      shown: true,
    });
    expect(placeEditor(state, { row: 2, col: 1 }).box).toEqual({
      x: 160,
      y: 84,
      width: 120,
      height: 28,
    });
  });

  it('keeps the box of a cell the header or the frozen columns cut, and clips it', () => {
    const scene = create({ frozenColumns: 1 });
    scene.setScroll(70, 160);

    expect(placeEditor(scene.state, { row: 2, col: 2 }, INSETS)).toEqual({
      box: {
        x: 160 + 240 - 120 - 160 + 1,
        y: 28 + 56 - 70 + 1,
        width: 117,
        height: 25,
      },
      clip: { left: 160 - 121, top: 13, right: 0, bottom: 0 },
      shown: true,
    });
  });

  it('holds the box of a cell out of view inside the cell area, and shows it not', () => {
    const scene = create();
    scene.setScroll(28 * 800, 0);

    expect(placeEditor(scene.state, { row: 2, col: 1 }, INSETS)).toEqual({
      box: { x: 161, y: 28, width: 117, height: 25 },
      clip: null,
      shown: false,
    });
  });

  it('shows no editor for a cell the grid no longer has', () => {
    const { state } = create({ rowCount: 3 });

    expect(placeEditor(state, { row: 5, col: 1 }, NO_INSETS).shown).toBe(false);
    expect(placeEditor(state, { row: 1, col: 40 }).shown).toBe(false);
  });
});
