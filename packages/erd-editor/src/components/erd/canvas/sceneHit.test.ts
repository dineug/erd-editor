import type { Context } from 'konva/lib/Context';
import type { Shape } from 'konva/lib/Shape';
import { describe, expect, it } from 'vite-plus/test';

import {
  columnCellHit,
  headerCellHit,
  type HitFunc,
  iconHit,
} from '@/components/erd/canvas/sceneHit';
import { ICON_VIEW_SIZE } from '@/components/erd/canvas/sceneTokens';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_HEADER_PADDING,
  VIEW_COLUMN_HEIGHT,
  VIEW_COLUMN_PADDING,
} from '@/constants/layout';

const CELL_WIDTH = 60;

type Box = [x: number, y: number, width: number, height: number];

type ShapeSeed = { width?: number; x?: number; y?: number };

/**
 * The box a hit function paints, taken off a context that records the rect
 * instead of filling one. Konva hands the shape's own space, so every number
 * here is relative to the node the box belongs to.
 */
function boxesOf(hit: HitFunc, seed: ShapeSeed = {}): Box[] {
  const boxes: Box[] = [];
  const context = {
    beginPath: () => {},
    rect: (x: number, y: number, width: number, height: number) =>
      boxes.push([x, y, width, height]),
    closePath: () => {},
    fillShape: () => {},
  } as unknown as Context;
  const shape = {
    width: () => seed.width ?? 0,
    x: () => seed.x ?? 0,
    y: () => seed.y ?? 0,
  } as unknown as Shape;

  hit(context, shape);

  return boxes;
}

const boxOf = (hit: HitFunc, seed: ShapeSeed = {}): Box =>
  boxesOf(hit, seed)[0];

describe('columnCellHit', () => {
  it('takes the whole document row and the gap to the next cell', () => {
    expect(boxesOf(columnCellHit.document, { width: CELL_WIDTH })).toEqual([
      [0, -COLUMN_PADDING, CELL_WIDTH + INPUT_MARGIN_RIGHT, COLUMN_HEIGHT],
    ]);
  });

  /**
   * A view row is shorter than the document's, and the box is the one thing
   * that does not follow the drawn row on its own: left on the document height
   * it would overhang the row below by the difference.
   */
  it('takes the shorter row a view draws, and no more', () => {
    const view = boxOf(columnCellHit.flow, { width: CELL_WIDTH });

    expect(view).toEqual([
      0,
      -VIEW_COLUMN_PADDING,
      CELL_WIDTH + INPUT_MARGIN_RIGHT,
      VIEW_COLUMN_HEIGHT,
    ]);
    expect(view[3]).toBeLessThan(COLUMN_HEIGHT);
  });
});

describe('headerCellHit', () => {
  it('takes the padded name box, which is the header a view draws whole', () => {
    expect(boxOf(headerCellHit, { width: CELL_WIDTH })).toEqual([
      0,
      -TABLE_HEADER_PADDING,
      CELL_WIDTH + INPUT_MARGIN_RIGHT,
      TABLE_HEADER_INPUT_HEIGHT,
    ]);
  });
});

describe('iconHit', () => {
  it('takes the icon box back at the corner the shape was moved from', () => {
    expect(boxOf(iconHit, { x: 5, y: 7 })).toEqual([
      -5,
      -7,
      ICON_VIEW_SIZE,
      ICON_VIEW_SIZE,
    ]);
  });
});
