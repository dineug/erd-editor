import type { Context } from 'konva/lib/Context';
import type { Shape } from 'konva/lib/Shape';
import type { Stage } from 'konva/lib/Stage';

import type { HeaderSelection } from '@/model/selection';
import { drawCells } from '@/scene/draw/cells';
import { drawHeaders, type HeaderBlock } from '@/scene/draw/headers';
import type { SceneState } from '@/scene/state';

/** What konva calls with a layer's context on each draw of the layer. */
export type SceneFunc = (context: Context, shape: Shape) => void;

const scenes = new WeakMap<Stage, SceneState>();

/**
 * Makes a scene the one the scene functions on a stage draw, and returns the
 * undoing. The functions are module constants, so the host never rewrites
 * them, and they find their state through the stage of the shape they paint.
 */
export function bindScene(stage: Stage, scene: SceneState): () => void {
  scenes.set(stage, scene);

  return () => {
    if (scenes.get(stage) === scene) scenes.delete(stage);
  };
}

function sceneOf(shape: Shape): SceneState | undefined {
  const stage = shape.getStage();

  return stage ? scenes.get(stage) : undefined;
}

function paintCells(context: Context, shape: Shape, frozen: boolean): void {
  const scene = sceneOf(shape);
  if (!scene) return;

  const { state } = scene;
  const { layout } = state;
  const { range } = scene.frame;
  const region = frozen ? layout.frozenBody : layout.body;

  drawCells(
    context._context,
    {
      width: region.width,
      height: region.height,
      left: frozen ? 0 : layout.scrollOrigin + state.scrollLeft,
      top: state.scrollTop,
      rowStart: range.rowStart,
      rowEnd: range.rowEnd,
      colStart: frozen ? 0 : range.colStart,
      colEnd: frozen ? range.frozenEnd : range.colEnd,
      rowHeight: state.rowHeight,
      offsets: state.offsets,
      columns: state.columns,
      frozenEdge: frozen,
    },
    {
      theme: state.theme,
      font: state.font,
      metrics: state.metrics,
      fitter: scene.fitter,
      getCell: state.getCell,
      getCellStyle: state.getCellStyle,
    }
  );
}

type HeaderRegion = 'corner' | 'column' | 'frozen' | 'row';

/** The header block of one region, in the region's own coordinates. */
function headerBlock(scene: SceneState, region: HeaderRegion): HeaderBlock {
  const { state, frame } = scene;
  const { layout } = state;
  const { range } = frame;
  const shared = {
    rowHeight: state.rowHeight,
    offsets: state.offsets,
    columns: state.columns,
  };

  switch (region) {
    case 'corner':
      return {
        ...shared,
        width: layout.corner.width,
        height: layout.corner.height,
        axis: 'column',
        origin: 0,
        start: 0,
        end: -1,
        bottomEdge: true,
        rightEdge: true,
      };
    case 'column':
      return {
        ...shared,
        width: layout.columnHeader.width,
        height: layout.columnHeader.height,
        axis: 'column',
        origin: layout.scrollOrigin + state.scrollLeft,
        start: range.colStart,
        end: range.colEnd,
        bottomEdge: true,
        rightEdge: false,
      };
    case 'frozen':
      return {
        ...shared,
        width: layout.frozenHeader.width,
        height: layout.frozenHeader.height,
        axis: 'column',
        origin: 0,
        start: 0,
        end: range.frozenEnd,
        bottomEdge: true,
        rightEdge: true,
      };
    case 'row':
      return {
        ...shared,
        width: layout.rowHeader.width,
        height: layout.rowHeader.height,
        axis: 'row',
        origin: state.scrollTop,
        start: range.rowStart,
        end: range.rowEnd,
        bottomEdge: false,
        rightEdge: true,
      };
  }
}

function paintHeaders(
  context: Context,
  shape: Shape,
  region: HeaderRegion,
  highlight: boolean
): void {
  const scene = sceneOf(shape);
  if (!scene) return;

  const { state, frame } = scene;
  let selection: HeaderSelection | undefined;
  if (highlight) selection = region === 'row' ? frame.rows : frame.columns;

  drawHeaders(
    context._context,
    headerBlock(scene, region),
    {
      theme: state.theme,
      font: state.font,
      metrics: state.metrics,
      fitter: scene.fitter,
    },
    selection
  );
}

/** The scrolling cells, right of the frozen columns. */
export const paintBody: SceneFunc = (context, shape) =>
  paintCells(context, shape, false);

/** The frozen columns' cells, which scroll down with the rows and never across. */
export const paintFrozenBody: SceneFunc = (context, shape) =>
  paintCells(context, shape, true);

/** The labels of the scrolling columns. */
export const paintColumnHeader: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'column', false);

/** The labels of the frozen columns. */
export const paintFrozenHeader: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'frozen', false);

/** The row numbers. */
export const paintRowHeader: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'row', false);

/** The corner above the row numbers and left of the column labels. */
export const paintCorner: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'corner', false);

/** The selected scrolling columns' labels, on the overlay. */
export const paintColumnHighlight: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'column', true);

/** The selected frozen columns' labels, on the overlay. */
export const paintFrozenHighlight: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'frozen', true);

/** The selected rows' numbers, on the overlay. */
export const paintRowHighlight: SceneFunc = (context, shape) =>
  paintHeaders(context, shape, 'row', true);
