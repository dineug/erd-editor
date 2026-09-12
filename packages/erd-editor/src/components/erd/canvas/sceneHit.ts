import type { Context } from 'konva/lib/Context';
import type { Shape } from 'konva/lib/Shape';

import { ICON_VIEW_SIZE } from '@/components/erd/canvas/sceneTokens';
import {
  getColumnTextY,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import {
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_INPUT_HEIGHT,
} from '@/constants/layout';
import { tableRowHeight } from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/** What konva calls to put a shape on the hit canvas, in the shape's own space. */
export type HitFunc = (context: Context, shape: Shape) => void;

/** One box in the shape's colour key and nothing on screen. */
function hitBox(
  context: Context,
  shape: Shape,
  x: number,
  y: number,
  width: number,
  height: number
) {
  context.beginPath();
  context.rect(x, y, width, height);
  context.closePath();
  context.fillShape(shape);
}

/**
 * The box a column cell's text answers a press for: the full row height and
 * the gap to the next cell, which is the div the dom scene put the input in.
 * The text carries it so the cell needs no shape that exists only to be hit.
 */
function columnCellHitOf(source: GeometrySource): HitFunc {
  return (context, shape) => {
    hitBox(
      context,
      shape,
      0,
      -getColumnTextY(source),
      shape.width() + INPUT_MARGIN_RIGHT,
      tableRowHeight(source)
    );
  };
}

/**
 * One of those per source, built once. A row is not the same height in a view
 * as in the document, and konva reads this off an attribute, so a function
 * built per render would mark every cell dirty every frame.
 */
export const columnCellHit: Record<GeometrySource, HitFunc> = {
  document: columnCellHitOf('document'),
  flow: columnCellHitOf('flow'),
};

/**
 * The header cell's box, the same way, at the header input's own height. One
 * value for both sources, because a view header is exactly that padded box
 * with no icon band over it.
 */
export const headerCellHit: HitFunc = (context, shape) => {
  hitBox(
    context,
    shape,
    0,
    -HEADER_TEXT_Y,
    shape.width() + INPUT_MARGIN_RIGHT,
    TABLE_HEADER_INPUT_HEIGHT
  );
};

/**
 * The whole 24 unit box of a lucide icon, answered by the first shape it draws.
 * A circle's origin is its centre, so its own position is what puts the box
 * back at the icon's corner.
 */
export const iconHit: HitFunc = (context, shape) => {
  hitBox(
    context,
    shape,
    -shape.x(),
    -shape.y(),
    ICON_VIEW_SIZE,
    ICON_VIEW_SIZE
  );
};
