import {
  getViewTransform,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import { hasViewport } from '@/engine/modules/settings/atom.actions';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getContentRects } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';

/** Which way the nearest entity lies and how far, while the screen holds none. */
export type ContentCompass = {
  /** Degrees clockwise from east, which is the rotation the arrow is drawn at. */
  angle: number;
  /** The gap between the screen and that entity, in scene units. */
  distance: number;
  /** Its middle, which is the scene point a press centres the screen on. */
  target: Point;
};

const DEGREES = 180 / Math.PI;

/** How far one rect lies outside another on each axis, zero where they overlap. */
function gapBetween(rect: Rect, other: Rect): Point {
  return {
    x: Math.max(
      rect.x - (other.x + other.width),
      other.x - (rect.x + rect.width),
      0
    ),
    y: Math.max(
      rect.y - (other.y + other.height),
      other.y - (rect.y + rect.height),
      0
    ),
  };
}

const middleOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * Where the nearest entity stands when the screen shows none of them, measured
 * from the screen's own middle. Null while any table or memo reaches the screen,
 * touching it counting as reaching it, and null while nobody has measured one.
 */
export function getContentCompass(state: RootState): ContentCompass | null {
  if (!hasViewport(state.editor.viewport)) return null;

  const screen = getVisibleCanvasRect(getViewTransform(state));
  let nearest: Rect | null = null;
  let distance = Infinity;

  for (const rect of getContentRects(state)) {
    const gap = gapBetween(screen, rect);
    if (gap.x === 0 && gap.y === 0) return null;

    const away = Math.hypot(gap.x, gap.y);
    if (away < distance) {
      distance = away;
      nearest = rect;
    }
  }

  if (!nearest) return null;

  const target = middleOf(nearest);
  const from = middleOf(screen);

  return {
    angle: Math.atan2(target.y - from.y, target.x - from.x) * DEGREES,
    distance,
    target,
  };
}

/** The steps the label folds into, each a thousand of the one before it. */
const UNITS = ['', 'k', 'M', 'B'];

const STEP = 1_000;

/** Below this a decimal still fits in four characters, and at it the round is 10. */
const DECIMAL_UNDER = 9.95;

/**
 * The gap as the pill prints it: whole scene units under a thousand, then
 * thousands, millions and billions carrying one decimal under ten, so the label
 * stays four characters wide however far the view has been carried.
 */
export function formatDistance(distance: number): string {
  let value = Math.round(Math.max(distance, 0));
  let label = String(value);
  let unit = 0;

  while (value >= STEP && unit < UNITS.length - 1) {
    const scaled = value / STEP;
    unit += 1;
    label =
      scaled < DECIMAL_UNDER ? scaled.toFixed(1) : String(Math.round(scaled));
    value = Number(label);
  }

  return `${label}${UNITS[unit]}`;
}
