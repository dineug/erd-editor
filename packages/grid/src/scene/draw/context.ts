import type { FontMetrics } from '@/font';
import type { TextFitter } from '@/model/text';
import type { GridTheme } from '@/theme';

/** A 2D context the draw functions paint on: a layer's own, or an offscreen one. */
export type DrawContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/** The room between a cell's edges and its text, on each side. */
export const CELL_PADDING = 8;

/** What every region paints its text with. */
export interface TextPaint {
  theme: Readonly<GridTheme>;
  /** The CSS font shorthand the metrics were measured in. */
  font: string;
  metrics: FontMetrics;
  fitter: TextFitter;
}

/**
 * The baseline offset from a row's top that centres a line of the font in it,
 * on a whole pixel. Without metrics, as in a realm with no canvas, it is the
 * row's middle.
 */
export function baselineOffset(
  rowHeight: number,
  metrics: FontMetrics
): number {
  return Math.round((rowHeight + metrics.ascent - metrics.descent) / 2);
}

/** Restricts what follows to a rectangle, until the matching restore. */
export function clipTo(
  context: DrawContext,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
}

/** Sets the text state every region draws with, which a layer's last shape may have left otherwise. */
export function setTextState(context: DrawContext, font: string): void {
  context.font = font;
  context.textBaseline = 'alphabetic';
  context.direction = 'ltr';
}
