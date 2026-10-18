import type { CellStyle, ColumnDef } from '@/model/types';
import {
  baselineOffset,
  CELL_PADDING,
  clipTo,
  type DrawContext,
  setTextState,
  type TextPaint,
} from '@/scene/draw/context';

/** The display string of one cell, which the host computes. */
export type CellGetter = (row: number, col: number) => string;

/** A host's style for one cell over the theme, or undefined to keep the theme. */
export type CellStyleGetter = (
  row: number,
  col: number
) => CellStyle | undefined;

/**
 * One cell region and the cells it draws. Its own origin is the region's
 * top-left corner, which shows the content point left and top, and nothing
 * is painted outside width and height.
 */
export interface CellBlock {
  width: number;
  height: number;
  left: number;
  top: number;
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  rowHeight: number;
  offsets: readonly number[];
  columns: readonly ColumnDef[];
  /** Whether the frozen border runs down the region's right edge. */
  frozenEdge: boolean;
}

/** The text paint plus the getters a cell region reads its cells through. */
export interface CellPaint extends TextPaint {
  getCell: CellGetter;
  getCellStyle?: CellStyleGetter;
}

/**
 * Paints a cell region: the theme background, each cell's own background, its
 * text left aligned in a clip of its column, and the grid lines over them.
 * Each getter is called once per cell drawn.
 */
export function drawCells(
  context: DrawContext,
  block: CellBlock,
  paint: CellPaint
): void {
  const { width, height, left, top, rowStart, rowEnd, rowHeight } = block;
  const { offsets, columns } = block;
  const { theme, fitter, getCell, getCellStyle } = paint;

  clipTo(context, 0, 0, width, height);
  context.fillStyle = theme.background;
  context.fillRect(0, 0, width, height);

  const firstY = rowStart * rowHeight - top;
  const lastX = offsets[block.colEnd + 1] - left;
  const lineWidth = Math.max(0, Math.min(width, lastX));
  const lineHeight = Math.max(
    0,
    Math.min(height, (rowEnd + 1) * rowHeight - top)
  );
  const baseline = baselineOffset(rowHeight, paint.metrics);
  let fill = '';

  setTextState(context, paint.font);
  context.textAlign = 'left';

  for (let col = block.colStart; col <= block.colEnd; col++) {
    const x = offsets[col] - left;
    const cellWidth = offsets[col + 1] - offsets[col];
    const contentWidth = cellWidth - CELL_PADDING * 2;
    const readonlyColumn = columns[col].readonly === true;

    clipTo(context, x, 0, cellWidth, height);

    for (let row = rowStart, y = firstY; row <= rowEnd; row++) {
      const style = getCellStyle?.(row, col);
      const background =
        style?.background ??
        (readonlyColumn || style?.readonly
          ? theme.readonlyBackground
          : undefined);

      if (background !== undefined) {
        fill = background;
        context.fillStyle = background;
        context.fillRect(x, y, cellWidth, rowHeight);
      }

      const text = getCell(row, col);
      const drawn = text ? fitter.fit(text, contentWidth) : '';

      if (drawn) {
        const colour = style?.color ?? theme.text;

        if (colour !== fill) {
          fill = colour;
          context.fillStyle = colour;
        }
        context.fillText(drawn, x + CELL_PADDING, y + baseline);
      }

      y += rowHeight;
    }

    context.restore();
    fill = theme.gridLine;
    context.fillStyle = fill;
    context.fillRect(x + cellWidth - 1, 0, 1, lineHeight);
  }

  context.fillStyle = theme.gridLine;
  for (let row = rowStart, y = firstY; row <= rowEnd; row++) {
    y += rowHeight;
    context.fillRect(0, y - 1, lineWidth, 1);
  }

  if (block.frozenEdge) {
    context.fillStyle = theme.frozenBorder;
    context.fillRect(width - 1, 0, 1, height);
  }

  context.restore();
}
