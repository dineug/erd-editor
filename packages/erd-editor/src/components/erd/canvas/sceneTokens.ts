import type { KonvaEventObject } from 'konva/lib/Node';

import { ICON_VIEW_BOX } from '@/components/primitives/icon/icons';
import { TABLE_BORDER, TABLE_PADDING } from '@/constants/layout';
import { TextFontFamily } from '@/styles/fonts.styles';

/** A pointer event as konva hands it to a listener bound on a scene node. */
export type SceneMouseEvent = KonvaEventObject<MouseEvent>;

export type SceneTouchEvent = KonvaEventObject<TouchEvent>;

export type ScenePointerEvent = SceneMouseEvent | SceneTouchEvent;

/**
 * The face utils/text.ts measures a string with. Drawing in anything else would
 * make a cell wider or narrower than the width the layout reserved for it.
 */
export const SCENE_FONT_FAMILY = TextFontFamily;

/** The px behind font-size-1, which is what typography.paragraph resolves to. */
export const SCENE_FONT_SIZE = 12;

/** The css font shorthand konva builds for a cell's text, and measures it with. */
export const SCENE_FONT = `normal normal ${SCENE_FONT_SIZE}px ${SCENE_FONT_FAMILY}`;

/** The pair a canvas centres a drawn line by, which no line box is involved in. */
export type SceneFontMetrics = {
  ascent: number;
  descent: number;
};

const NO_SCENE_FONT_METRICS: SceneFontMetrics = { ascent: 0, descent: 0 };

let sceneFontMetrics: SceneFontMetrics | null = null;

/**
 * The ascent and descent konva centres a drawn line by, read with the measure
 * call konva makes itself. A canvas has no line box to lean on, so this pair is
 * the whole of where a baseline lands, and the editor has to read the same one.
 *
 * @example
 * const { ascent, descent } = getSceneFontMetrics();
 */
export function getSceneFontMetrics(): SceneFontMetrics {
  if (sceneFontMetrics) return sceneFontMetrics;
  if (typeof document === 'undefined') return NO_SCENE_FONT_METRICS;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return NO_SCENE_FONT_METRICS;

  context.font = SCENE_FONT;
  const metrics = context.measureText('M');
  const ascent =
    metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent =
    metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) {
    return NO_SCENE_FONT_METRICS;
  }

  sceneFontMetrics = { ascent, descent };
  return sceneFontMetrics;
}

/**
 * The px behind font-size-5 through font-size-9, in the order HighLevelTable
 * steps through them as the zoom falls. The scale itself is a CSS custom
 * property, and a canvas has no way to read one.
 */
export const HIGH_LEVEL_FONT_SIZES = [20, 24, 28, 35, 60] as const;

/** Border plus padding on one side, which is where a table's own content starts. */
export const TABLE_INSET = TABLE_BORDER + TABLE_PADDING;

/** The radius Table.styles rounds a table box with. */
export const TABLE_CORNER_RADIUS = 6;

/** The min-height Table.styles gives the colour bar across a table header. */
export const HEADER_COLOR_HEIGHT = 4;

/** The 1.5px underline EditInput draws for a focused, edited or shared cell. */
export const FOCUS_BORDER_HEIGHT = 1.5;

/** What the ring outside a table box costs, as outline and box-shadow both do. */
export const RING_WIDTH = 1;

/** The side of the square viewBox every icon is authored in. */
export const ICON_VIEW_SIZE = Number(ICON_VIEW_BOX.split(' ')[2]);

/** What a colour is when the scene paints nothing, as a CSS keyword konva takes. */
export const TRANSPARENT = 'transparent';

/**
 * A fill that paints nothing and still answers a hit test, which is how a cell
 * keeps the whole padded box clickable the way its div did.
 */
export const HIT_FILL = TRANSPARENT;

/** The hand a clickable scene node asks for, as the dom scene spelt it in css. */
export const CURSOR_POINTER = 'pointer';

/** The beam a textarea carried on its own, which a drawn body has to ask for. */
export const CURSOR_TEXT = 'text';

/** What a node hands back on the way out, leaving the container its own cursor. */
export const CURSOR_INHERIT = '';

/**
 * Points the stage container at a cursor. A konva node carries none of its own,
 * so the container is where the css the dom scene put on an element now lives.
 *
 * @example
 * on:mouseenter={(event) => setSceneCursor(event, CURSOR_POINTER)}
 */
export function setSceneCursor(event: ScenePointerEvent, cursor: string): void {
  const container = event.target?.getStage()?.container();
  if (container) container.style.cursor = cursor;
}
