import type { Context } from 'konva/lib/Context';
import type { Shape } from 'konva/lib/Shape';

import { ICON_VIEW_SIZE } from '@/components/erd/canvas/sceneTokens';
import {
  COLUMN_TEXT_Y,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import {
  COLUMN_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_INPUT_HEIGHT,
} from '@/constants/layout';

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
export const columnCellHit: HitFunc = (context, shape) => {
  hitBox(
    context,
    shape,
    0,
    -COLUMN_TEXT_Y,
    shape.width() + INPUT_MARGIN_RIGHT,
    COLUMN_HEIGHT
  );
};

/** The header cell's box, the same way, at the header input's own height. */
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
