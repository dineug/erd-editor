import type { Viewport } from '@/engine/modules/editor/state';
import type { Rect } from '@/konva/scene/metrics';

/** The room between the buttons and the table, and between them and the canvas edge. */
export const PILL_MARGIN = 8;

/** How far past the buttons' outer edge the gutter beside them reaches. */
export const GUTTER_REACH = 4;

export type PillSide = 'left' | 'right';

export type PillSize = { width: number; height: number };

export type PillPlacement = { x: number; y: number; side: PillSide };

export type PlacePillInput = {
  /** The table's box on screen. */
  card: Rect;
  viewport: Viewport;
  /** How far in from the left edge Find and Replace hides the canvas. */
  covered: number;
  /** The chrome drawn over the canvas that the buttons keep clear of. */
  obstacles: readonly Rect[];
  pill: PillSize;
};

/** Strict, so two boxes that only touch along an edge leave each other clear. */
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/** The part of the table's height the canvas shows, a margin in from its edges. */
export function getVisibleSpan(
  card: Rect,
  viewport: Viewport
): { top: number; bottom: number } {
  return {
    top: Math.max(card.y, PILL_MARGIN),
    bottom: Math.min(card.y + card.height, viewport.height - PILL_MARGIN),
  };
}

/**
 * Left of the table, else right of it, else over its left edge; level with the
 * top of its shown part and inside the canvas. Off the minimap and the floating
 * toolbar by moving below or above it, then by the other side, else put.
 */
export function placePill({
  card,
  viewport,
  covered,
  obstacles,
  pill,
}: PlacePillInput): PillPlacement {
  const span = getVisibleSpan(card, viewport);
  const y = Math.min(
    span.top,
    Math.max(PILL_MARGIN, viewport.height - PILL_MARGIN - pill.height)
  );

  const left = card.x - PILL_MARGIN - pill.width;
  const right = card.x + card.width + PILL_MARGIN;
  const sides: Array<[PillSide, number]> = [];

  if (left >= PILL_MARGIN + covered) sides.push(['left', left]);
  if (right + pill.width <= viewport.width - PILL_MARGIN) {
    sides.push(['right', right]);
  }

  if (!sides.length) {
    return { x: PILL_MARGIN + covered, y, side: 'left' };
  }

  const boxAt = (x: number, top: number): Rect => ({
    x,
    y: top,
    width: pill.width,
    height: pill.height,
  });
  const isClear = (x: number, top: number) =>
    !obstacles.some(obstacle => overlaps(boxAt(x, top), obstacle));
  // A move keeps the middle of the buttons beside the table's shown part and
  // all of them inside the canvas, where the press it offers can reach them.
  const canStand = (top: number) => {
    const middle = top + pill.height / 2;
    return (
      middle >= span.top &&
      middle <= span.bottom &&
      top >= PILL_MARGIN &&
      top + pill.height <= viewport.height - PILL_MARGIN
    );
  };

  const settle = (x: number): number | null => {
    if (isClear(x, y)) return y;

    for (const obstacle of obstacles) {
      if (!overlaps(boxAt(x, y), obstacle)) continue;

      const below = obstacle.y + obstacle.height;
      if (canStand(below) && isClear(x, below)) return below;

      const above = obstacle.y - pill.height;
      if (canStand(above) && isClear(x, above)) return above;
    }

    return null;
  };

  for (const [side, x] of sides) {
    const top = settle(x);
    if (top !== null) return { x, y: top, side };
  }

  const [side, x] = sides[0];
  return { x, y, side };
}

/**
 * The clear strip from a little past the buttons to the table, as tall as both,
 * which takes a press that would reach a neighbour or the start table under it,
 * so only the outlined table is drawn to. None where the buttons cover the table.
 */
export function getGutterRect({
  card,
  viewport,
  placement,
  pill,
}: {
  card: Rect;
  viewport: Viewport;
  placement: PillPlacement;
  pill: PillSize;
}): Rect | null {
  const span = getVisibleSpan(card, viewport);
  const top = Math.min(span.top, placement.y);
  const bottom = Math.max(span.bottom, placement.y + pill.height);
  const [start, end] =
    placement.side === 'left'
      ? [placement.x - GUTTER_REACH, card.x]
      : [card.x + card.width, placement.x + pill.width + GUTTER_REACH];

  if (end <= start || bottom <= top) return null;

  return { x: start, y: top, width: end - start, height: bottom - top };
}
