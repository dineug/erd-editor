import { query } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { DrawRelationship } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';
import { createTable } from '@/utils/collection/table.entity';
import { getDraw } from '@/utils/draw-relationship/draw';

// The default `show` flags plus the default 60px name/comment widths make an
// empty table exactly 365 x 56, so `table-a` at (0, 0) has these anchors:
const TABLE_WIDTH = 365;
const TABLE_HEIGHT = 56;
const CENTER_X = TABLE_WIDTH / 2; // 182.5
const CENTER_Y = TABLE_HEIGHT / 2; // 28

function createState(): RootState {
  const state = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  }).state;
  query(state.collections)
    .collection('tableEntities')
    .addOne(createTable({ id: 'table-a', ui: { x: 0, y: 0 } }));
  return state;
}

function createDraw(end: { x: number; y: number }): DrawRelationship {
  return {
    relationshipType: 0,
    start: { tableId: 'table-a', x: 0, y: 0 },
    end,
  };
}

describe('getDraw', () => {
  let state: RootState;

  beforeEach(() => {
    state = createState();
  });

  it('returns a zeroed path when there is no start point', () => {
    const draw: DrawRelationship = {
      relationshipType: 0,
      start: null,
      end: { x: 400, y: 400 },
    };

    const result = getDraw(state, draw);

    expect(result.path.path.M).toEqual({ x: 0, y: 0 });
    expect(result.path.path.L).toEqual({ x: 0, y: 0 });
    expect(result.path.path.Q).toEqual({ x: 0, y: 0 });
    expect(result.path.path.d()).toBe('M 0 0 L 0 0');
    expect(result.path.line.start).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.base).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.base2).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.center).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.center2).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
  });

  describe('bottom direction', () => {
    it('snaps the start point to the bottom anchor and draws downwards', () => {
      const draw = createDraw({ x: CENTER_X, y: 500 });

      const result = getDraw(state, draw);

      expect(draw.start).toEqual({
        tableId: 'table-a',
        x: CENTER_X,
        y: TABLE_HEIGHT,
      });
      expect(result.path.line.start).toEqual({
        x1: CENTER_X,
        y1: TABLE_HEIGHT + 25,
        x2: CENTER_X,
        y2: TABLE_HEIGHT + 50,
      });
      expect(result.path.path.M).toEqual({ x: CENTER_X, y: TABLE_HEIGHT + 50 });
      expect(result.path.path.L).toEqual({ x: CENTER_X, y: 500 });
      expect(result.path.path.d()).toBe('M 182.5 106 L 182.5 500');
    });

    it('offsets the crow foot lines below the bottom anchor', () => {
      const draw = createDraw({ x: CENTER_X, y: 500 });

      const { line } = getDraw(state, draw);

      expect(line.start.base).toEqual({
        x1: CENTER_X - 7,
        y1: TABLE_HEIGHT + 11,
        x2: CENTER_X + 7,
        y2: TABLE_HEIGHT + 11,
      });
      expect(line.start.base2).toEqual({
        x1: CENTER_X - 7,
        y1: TABLE_HEIGHT + 18,
        x2: CENTER_X + 7,
        y2: TABLE_HEIGHT + 18,
      });
      expect(line.start.center).toEqual({
        x1: CENTER_X,
        y1: TABLE_HEIGHT + 11,
        x2: CENTER_X,
        y2: TABLE_HEIGHT,
      });
      expect(line.start.center2).toEqual({
        x1: CENTER_X,
        y1: TABLE_HEIGHT + 25,
        x2: CENTER_X,
        y2: TABLE_HEIGHT,
      });
    });

    it('prefers bottom when another anchor is exactly as close', () => {
      // the table centre is equidistant from the top and the bottom anchor
      const draw = createDraw({ x: CENTER_X, y: CENTER_Y });

      const result = getDraw(state, draw);

      expect(draw.start).toEqual({
        tableId: 'table-a',
        x: CENTER_X,
        y: TABLE_HEIGHT,
      });
      expect(result.path.path.M).toEqual({ x: CENTER_X, y: TABLE_HEIGHT + 50 });
    });
  });

  describe('top direction', () => {
    it('snaps to the top anchor and flips every offset', () => {
      const draw = createDraw({ x: CENTER_X, y: -500 });

      const result = getDraw(state, draw);

      expect(draw.start).toEqual({ tableId: 'table-a', x: CENTER_X, y: 0 });
      expect(result.path.line.start).toEqual({
        x1: CENTER_X,
        y1: -25,
        x2: CENTER_X,
        y2: -50,
      });
      expect(result.path.path.M).toEqual({ x: CENTER_X, y: -50 });
      expect(result.path.path.L).toEqual({ x: CENTER_X, y: -500 });
      expect(result.path.path.d()).toBe('M 182.5 -50 L 182.5 -500');
      expect(result.line.start.base).toEqual({
        x1: CENTER_X - 7,
        y1: -11,
        x2: CENTER_X + 7,
        y2: -11,
      });
      expect(result.line.start.base2).toEqual({
        x1: CENTER_X - 7,
        y1: -18,
        x2: CENTER_X + 7,
        y2: -18,
      });
      expect(result.line.start.center).toEqual({
        x1: CENTER_X,
        y1: -11,
        x2: CENTER_X,
        y2: 0,
      });
      expect(result.line.start.center2).toEqual({
        x1: CENTER_X,
        y1: -25,
        x2: CENTER_X,
        y2: 0,
      });
    });
  });

  describe('left direction', () => {
    it('snaps to the left anchor and grows along the negative x axis', () => {
      const draw = createDraw({ x: -500, y: CENTER_Y });

      const result = getDraw(state, draw);

      expect(draw.start).toEqual({ tableId: 'table-a', x: 0, y: CENTER_Y });
      expect(result.path.line.start).toEqual({
        x1: -25,
        y1: CENTER_Y,
        x2: -50,
        y2: CENTER_Y,
      });
      expect(result.path.path.M).toEqual({ x: -50, y: CENTER_Y });
      expect(result.path.path.L).toEqual({ x: -500, y: CENTER_Y });
      expect(result.path.path.d()).toBe('M -50 28 L -500 28');
      expect(result.line.start.base).toEqual({
        x1: -11,
        y1: CENTER_Y - 7,
        x2: -11,
        y2: CENTER_Y + 7,
      });
      expect(result.line.start.base2).toEqual({
        x1: -18,
        y1: CENTER_Y - 7,
        x2: -18,
        y2: CENTER_Y + 7,
      });
      expect(result.line.start.center).toEqual({
        x1: -11,
        y1: CENTER_Y,
        x2: 0,
        y2: CENTER_Y,
      });
      expect(result.line.start.center2).toEqual({
        x1: -25,
        y1: CENTER_Y,
        x2: 0,
        y2: CENTER_Y,
      });
    });
  });

  describe('right direction', () => {
    it('snaps to the right anchor and grows along the positive x axis', () => {
      const draw = createDraw({ x: 900, y: CENTER_Y });

      const result = getDraw(state, draw);

      expect(draw.start).toEqual({
        tableId: 'table-a',
        x: TABLE_WIDTH,
        y: CENTER_Y,
      });
      expect(result.path.line.start).toEqual({
        x1: TABLE_WIDTH + 25,
        y1: CENTER_Y,
        x2: TABLE_WIDTH + 50,
        y2: CENTER_Y,
      });
      expect(result.path.path.M).toEqual({
        x: TABLE_WIDTH + 50,
        y: CENTER_Y,
      });
      expect(result.path.path.L).toEqual({ x: 900, y: CENTER_Y });
      expect(result.path.path.d()).toBe('M 415 28 L 900 28');
      expect(result.line.start.base).toEqual({
        x1: TABLE_WIDTH + 11,
        y1: CENTER_Y - 7,
        x2: TABLE_WIDTH + 11,
        y2: CENTER_Y + 7,
      });
      expect(result.line.start.base2).toEqual({
        x1: TABLE_WIDTH + 18,
        y1: CENTER_Y - 7,
        x2: TABLE_WIDTH + 18,
        y2: CENTER_Y + 7,
      });
      expect(result.line.start.center).toEqual({
        x1: TABLE_WIDTH + 11,
        y1: CENTER_Y,
        x2: TABLE_WIDTH,
        y2: CENTER_Y,
      });
      expect(result.line.start.center2).toEqual({
        x1: TABLE_WIDTH + 25,
        y1: CENTER_Y,
        x2: TABLE_WIDTH,
        y2: CENTER_Y,
      });
    });
  });

  it('follows the table when it moves', () => {
    query(state.collections)
      .collection('tableEntities')
      .updateOne('table-a', table => {
        table.ui.x = 1000;
        table.ui.y = 700;
      });
    const draw = createDraw({ x: 1000 + CENTER_X, y: 2000 });

    const result = getDraw(state, draw);

    expect(draw.start).toEqual({
      tableId: 'table-a',
      x: 1000 + CENTER_X,
      y: 700 + TABLE_HEIGHT,
    });
    expect(result.path.path.M).toEqual({
      x: 1000 + CENTER_X,
      y: 700 + TABLE_HEIGHT + 50,
    });
  });

  it('leaves the start point untouched and falls back to bottom for an unknown table', () => {
    const draw: DrawRelationship = {
      relationshipType: 0,
      start: { tableId: 'does-not-exist', x: 10, y: 20 },
      end: { x: -900, y: 20 },
    };

    const result = getDraw(state, draw);

    expect(draw.start).toEqual({ tableId: 'does-not-exist', x: 10, y: 20 });
    // bottom is the default direction, so the path still grows downwards even
    // though the end point sits to the left
    expect(result.path.line.start).toEqual({ x1: 10, y1: 45, x2: 10, y2: 70 });
    expect(result.path.path.M).toEqual({ x: 10, y: 70 });
    expect(result.path.path.L).toEqual({ x: -900, y: 20 });
    expect(result.line.start.base).toEqual({ x1: 3, y1: 31, x2: 17, y2: 31 });
    expect(result.line.start.center2).toEqual({
      x1: 10,
      y1: 45,
      x2: 10,
      y2: 20,
    });
  });

  it('degrades to a zeroed line when the start point disappears mid-call', () => {
    const start = { tableId: 'table-a', x: 0, y: 0 };
    let reads = 0;
    const draw = {
      relationshipType: 0,
      get start() {
        return reads++ === 0 ? start : null;
      },
      end: { x: CENTER_X, y: 500 },
    } as DrawRelationship;

    const result = getDraw(state, draw);

    expect(reads).toBeGreaterThan(1);
    expect(result.path.line.start).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.path.path.M).toEqual({ x: 0, y: 0 });
    // the end point is assigned outside of the start guard
    expect(result.path.path.L).toEqual({ x: CENTER_X, y: 500 });
    expect(result.path.path.d()).toBe('M 0 0 L 182.5 500');
    expect(result.line.start.base).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.base2).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.center).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(result.line.start.center2).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(start).toEqual({ tableId: 'table-a', x: 0, y: 0 });
  });
});
