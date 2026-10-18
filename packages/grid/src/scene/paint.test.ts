// What each scene function hands its draw function: the region's size, the
// content offset it starts at and the cells or header cells in view. The draw
// functions stand in here; draw/*.browser.test.ts paints them for real.

import type { Context } from 'konva/lib/Context';
import type { Shape } from 'konva/lib/Shape';
import type { Stage } from 'konva/lib/Stage';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ColumnDef } from '@/model/types';
import {
  bindScene,
  paintBody,
  paintColumnHeader,
  paintColumnHighlight,
  paintCorner,
  paintFrozenBody,
  paintFrozenHeader,
  paintFrozenHighlight,
  paintRowHeader,
  paintRowHighlight,
} from '@/scene/paint';
import {
  createSceneState,
  type SceneFrame,
  type SceneState,
} from '@/scene/state';

const draws = vi.hoisted(() => ({
  drawCells: vi.fn(),
  drawHeaders: vi.fn(),
}));

vi.mock('@/scene/draw/cells', () => ({ drawCells: draws.drawCells }));
vi.mock('@/scene/draw/headers', () => ({ drawHeaders: draws.drawHeaders }));
vi.mock('@dineug/r-html-konva', () => ({
  markDirty: vi.fn(),
  requestFlush: vi.fn(),
}));

const COLUMNS: ColumnDef[] = Array.from({ length: 20 }, (_, index) => ({
  id: `c${index}`,
  label: `${index}`,
  width: 100,
}));

const native = {} as CanvasRenderingContext2D;

const context = { _context: native } as unknown as Context;

function scene(): [SceneState, Shape] {
  const state = createSceneState({
    rowCount: 1000,
    columns: COLUMNS,
    getCell: () => '',
    width: 800,
    height: 600,
    frozenColumns: 2,
  });
  const stage = {} as Stage;
  const shape = { getStage: () => stage } as unknown as Shape;

  bindScene(stage, state);
  state.setScroll(28 * 10, 150);

  return [state, shape];
}

/** Settles the frame a layer's beforeDraw would, the header cells given. */
function settle(state: SceneState, headers: Partial<SceneFrame> = {}) {
  const range = state.visibleRange();
  Object.assign(state.frame, { range, ...headers });

  return range;
}

beforeEach(() => {
  draws.drawCells.mockClear();
  draws.drawHeaders.mockClear();
});

describe('the cell regions', () => {
  it('hand the scrolling cells their content offset and the scrolling columns', () => {
    const [state, shape] = scene();
    const range = settle(state);

    paintBody(context, shape);

    const [target, block, paint] = draws.drawCells.mock.calls[0];
    const { layout } = state.state;

    expect(target).toBe(native);
    expect(block).toMatchObject({
      width: layout.body.width,
      height: layout.body.height,
      left: 200 + 150,
      top: 280,
      rowStart: range.rowStart,
      rowEnd: range.rowEnd,
      colStart: range.colStart,
      colEnd: range.colEnd,
      frozenEdge: false,
    });
    expect(paint).toMatchObject({
      theme: state.state.theme,
      fitter: state.fitter,
      getCell: state.state.getCell,
    });
  });

  it('hand the frozen cells the content start and the frozen columns', () => {
    const [state, shape] = scene();
    settle(state);

    paintFrozenBody(context, shape);

    expect(draws.drawCells.mock.calls[0][1]).toMatchObject({
      width: 200,
      left: 0,
      top: 280,
      colStart: 0,
      colEnd: 1,
      frozenEdge: true,
    });
  });
});

describe('the header regions', () => {
  it('hand each header its axis, its cells and the edges it borders', () => {
    const [state, shape] = scene();
    const range = settle(state);

    paintColumnHeader(context, shape);
    paintFrozenHeader(context, shape);
    paintRowHeader(context, shape);
    paintCorner(context, shape);

    const blocks = draws.drawHeaders.mock.calls.map(([, block]) => block);
    const selections = draws.drawHeaders.mock.calls.map(([, , , sel]) => sel);

    expect(blocks[0]).toMatchObject({
      axis: 'column',
      origin: 350,
      start: range.colStart,
      end: range.colEnd,
      bottomEdge: true,
      rightEdge: false,
    });
    expect(blocks[1]).toMatchObject({
      axis: 'column',
      origin: 0,
      start: 0,
      end: 1,
      bottomEdge: true,
      rightEdge: true,
    });
    expect(blocks[2]).toMatchObject({
      axis: 'row',
      origin: 280,
      start: range.rowStart,
      end: range.rowEnd,
      bottomEdge: false,
      rightEdge: true,
    });
    expect(blocks[3]).toMatchObject({
      start: 0,
      end: -1,
      bottomEdge: true,
      rightEdge: true,
      width: state.state.layout.corner.width,
    });
    expect(selections).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('hand each highlight the header cells the selection reaches', () => {
    const [state, shape] = scene();
    const columns = { intersected: [{ start: 3, end: 3 }], covered: [] };
    const rows = { intersected: [{ start: 12, end: 999 }], covered: [] };
    settle(state, { columns, rows });

    paintColumnHighlight(context, shape);
    paintFrozenHighlight(context, shape);
    paintRowHighlight(context, shape);

    expect(draws.drawHeaders.mock.calls.map(([, , , sel]) => sel)).toEqual([
      columns,
      columns,
      rows,
    ]);
  });
});

describe('a shape with no scene', () => {
  it('draws nothing off a stage, or on a stage whose scene was let go', () => {
    const loose = { getStage: () => null } as unknown as Shape;
    const unbound = { getStage: () => ({}) } as unknown as Shape;

    paintBody(context, loose);
    paintRowHeader(context, unbound);

    expect(draws.drawCells).not.toHaveBeenCalled();
    expect(draws.drawHeaders).not.toHaveBeenCalled();
  });

  it('keeps the newer scene when an older binding is undone', () => {
    const [first] = scene();
    const [second] = scene();
    const stage = {} as Stage;
    const shape = { getStage: () => stage } as unknown as Shape;
    const unbindFirst = bindScene(stage, first);
    const unbindSecond = bindScene(stage, second);

    unbindFirst();
    paintCorner(context, shape);
    expect(draws.drawHeaders).toHaveBeenCalledTimes(1);

    unbindSecond();
    paintCorner(context, shape);
    expect(draws.drawHeaders).toHaveBeenCalledTimes(1);
  });
});
