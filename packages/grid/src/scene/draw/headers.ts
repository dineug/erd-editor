import { type HeaderSelection, headerState } from '@/model/selection';
import type { ColumnDef } from '@/model/types';
import {
  baselineOffset,
  CELL_PADDING,
  clipTo,
  type DrawContext,
  setTextState,
  type TextPaint,
} from '@/scene/draw/context';

/**
 * One header region and the header cells it draws, along its axis: column
 * labels across, or row numbers counting from 1 down. Its origin is the
 * region's top-left corner, which shows the content offset origin.
 */
export interface HeaderBlock {
  axis: 'column' | 'row';
  width: number;
  height: number;
  origin: number;
  start: number;
  end: number;
  rowHeight: number;
  offsets: readonly number[];
  columns: readonly ColumnDef[];
  /** Whether the frozen border runs along the region's bottom edge. */
  bottomEdge: boolean;
  /** Whether the frozen border runs down the region's right edge. */
  rightEdge: boolean;
}

/**
 * Paints a header region. Without a selection it paints every header cell on
 * the header background; with one it paints only the cells the selection
 * reaches, opaque in the selected tokens, over a region already painted.
 */
export function drawHeaders(
  context: DrawContext,
  block: HeaderBlock,
  paint: TextPaint,
  selection?: HeaderSelection
): void {
  const { axis, width, height, origin, rowHeight, offsets, columns } = block;
  const { theme, fitter } = paint;
  const baseline = baselineOffset(rowHeight, paint.metrics);

  /** The frozen border where an area painted just now meets the region's edge. */
  const edges = (x: number, y: number, w: number, h: number) => {
    context.fillStyle = theme.frozenBorder;
    if (block.bottomEdge && y + h > height - 1) {
      context.fillRect(x, height - 1, w, 1);
    }
    if (block.rightEdge && x + w > width - 1) {
      context.fillRect(width - 1, y, 1, h);
    }
  };

  clipTo(context, 0, 0, width, height);
  setTextState(context, paint.font);
  context.textAlign = 'center';

  if (!selection) {
    context.fillStyle = theme.headerBackground;
    context.fillRect(0, 0, width, height);
  }

  for (let index = block.start; index <= block.end; index++) {
    const state = selection ? headerState(selection, index) : 'none';
    if (selection && state === 'none') continue;

    const column = axis === 'column';
    const x = column ? offsets[index] - origin : 0;
    const y = column ? 0 : index * rowHeight - origin;
    const w = column ? offsets[index + 1] - offsets[index] : width;
    const h = column ? height : rowHeight;

    if (state !== 'none') {
      context.fillStyle =
        state === 'covered'
          ? theme.fullSelectionBackground
          : theme.selectedHeaderBackground;
      context.fillRect(x, y, w, h);
    }

    const label = column
      ? fitter.fit(columns[index].label, w - CELL_PADDING * 2)
      : String(index + 1);

    if (label) {
      clipTo(context, x, y, w, h);
      context.fillStyle =
        state === 'covered' ? theme.selectedHeaderText : theme.headerText;
      context.fillText(label, x + w / 2, y + baseline);
      context.restore();
    }

    context.fillStyle = theme.gridLine;
    if (column) {
      context.fillRect(x + w - 1, 0, 1, h);
    } else {
      context.fillRect(0, y + h - 1, w, 1);
    }

    if (selection) edges(x, y, w, h);
  }

  if (!selection) edges(0, 0, width, height);
  context.restore();
}
