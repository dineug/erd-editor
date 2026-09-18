import { noop } from 'es-toolkit';
import type { KonvaEventObject } from 'konva/lib/Node';

import { ICON_VIEW_BOX } from '@/components/primitives/icon/icons';
import {
  CELL_FONT_SIZE,
  TABLE_BORDER,
  TABLE_PADDING,
} from '@/constants/layout';
import { CodeFontFamily, TextFontFamily } from '@/styles/fonts.styles';
import { isMouseEvent } from '@/utils/domEvent';

/** A pointer event as konva hands it to a listener bound on a scene node. */
export type SceneMouseEvent = KonvaEventObject<MouseEvent>;

export type SceneTouchEvent = KonvaEventObject<TouchEvent>;

export type ScenePointerEvent = SceneMouseEvent | SceneTouchEvent;

/**
 * The face utils/text.ts measures a string with. Drawing in anything else would
 * make a cell wider or narrower than the width the layout reserved for it.
 */
export const SCENE_FONT_FAMILY = TextFontFamily;

/**
 * The monospace face a view draws a type cell in, the same stack the code
 * panels use. A second face on the scene, so the metrics below are kept per
 * face rather than as the one pair the text face used to be the whole of.
 */
export const SCENE_CODE_FONT_FAMILY = CodeFontFamily;

/** The px behind font-size-1, which is what typography.paragraph resolves to. */
export const SCENE_FONT_SIZE = CELL_FONT_SIZE;

/** The css font shorthand konva builds for a cell's text in the face given, and measures it with. */
const sceneFontOf = (fontFamily: string) =>
  `normal normal ${SCENE_FONT_SIZE}px ${fontFamily}`;

/** That shorthand in the text face. */
export const SCENE_FONT = sceneFontOf(SCENE_FONT_FAMILY);

/** The weight every cell but a view card's header name is drawn at. */
export const SCENE_FONT_WEIGHT = 'normal';

/** The heavier weight a view card draws its header name at. */
export const VIEW_HEADER_FONT_WEIGHT = '500';

/** The pair a canvas centres a drawn line by, which no line box is involved in. */
export type SceneFontMetrics = {
  ascent: number;
  descent: number;
};

const NO_SCENE_FONT_METRICS: SceneFontMetrics = { ascent: 0, descent: 0 };

const sceneFontMetrics = new Map<string, SceneFontMetrics>();

/**
 * The ascent and descent konva centres a drawn line by, read with the measure
 * call konva makes itself, and kept per face: the scene draws a type cell in
 * the code face, whose overhang is not the text face's and whose baseline is its own.
 *
 * @example
 * const { ascent, descent } = getSceneFontMetrics();
 */
export function getSceneFontMetrics(
  fontFamily: string = SCENE_FONT_FAMILY
): SceneFontMetrics {
  const held = sceneFontMetrics.get(fontFamily);
  if (held) return held;
  if (typeof document === 'undefined') return NO_SCENE_FONT_METRICS;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return NO_SCENE_FONT_METRICS;

  context.font = sceneFontOf(fontFamily);
  const metrics = context.measureText('M');
  const ascent =
    metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent =
    metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) {
    return NO_SCENE_FONT_METRICS;
  }

  const measured = { ascent, descent };
  sceneFontMetrics.set(fontFamily, measured);
  return measured;
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

/** The 1.5px underline EditInput draws for a focused, edited or shared cell. */
export const FOCUS_BORDER_HEIGHT = 1.5;

/** What the ring outside a table box costs, as outline and box-shadow both do. */
export const RING_WIDTH = 1;

/**
 * The drop shadow a view card sits on, deeper than any a document box casts.
 * The alpha is the shadow's own, since the minimap shadow token it borrows is
 * an opaque black.
 */
export const VIEW_CARD_SHADOW_BLUR = 20;

export const VIEW_CARD_SHADOW_OFFSET_X = 0;

export const VIEW_CARD_SHADOW_OFFSET_Y = 2;

export const VIEW_CARD_SHADOW_OPACITY = 0.4;

/** A drop shadow as the five konva shadow attrs a body sets from it. */
export type CardShadow = {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
};

export const DOCUMENT_CARD_SHADOW_BLUR = 10;

export const DOCUMENT_CARD_SHADOW_OFFSET_Y = 2;

/**
 * The bloom a lit view card wears, drawn as a shadow on a stroke and never as
 * a filled sibling: a fill behind the body would have to be reordered under it,
 * and the ledger is the only thing allowed to order the scene.
 */
export const VIEW_CARD_GLOW_BLUR = 14;

export const VIEW_CARD_GLOW_OPACITY = 0.55;

/** The side of the square viewBox every icon is authored in. */
export const ICON_VIEW_SIZE = Number(ICON_VIEW_BOX.split(' ')[2]);

/** What a colour is when the scene paints nothing, as a CSS keyword konva takes. */
export const TRANSPARENT = 'transparent';

/**
 * A fill that paints nothing and still answers a hit test, which is how a cell
 * keeps the whole padded box clickable the way its div did.
 */
export const HIT_FILL = TRANSPARENT;

/**
 * What asks a box for no shadow: the palette's transparent, and the none or the
 * blank an override is likelier to write, which konva would paint black.
 */
const NO_SHADOW: ReadonlySet<string> = new Set([TRANSPARENT, 'none', '']);

/**
 * The shadow a document table or memo casts, in a colour carrying its alpha. No
 * shadow sets no attr at all, so the canvas never spends a blur on nothing, and
 * a scene with no theme above it reads every token as undefined.
 */
export function documentCardShadow(
  color: string | undefined
): CardShadow | null {
  const value = (color ?? '').trim();
  if (NO_SHADOW.has(value)) return null;

  return {
    color: value,
    blur: DOCUMENT_CARD_SHADOW_BLUR,
    offsetX: 0,
    offsetY: DOCUMENT_CARD_SHADOW_OFFSET_Y,
    opacity: 1,
  };
}

/** The hand a clickable scene node asks for, as the dom scene spelt it in css. */
export const CURSOR_POINTER = 'pointer';

/** The beam a textarea carried on its own, which a drawn body has to ask for. */
export const CURSOR_TEXT = 'text';

/** What a node hands back on the way out, leaving the container its own cursor. */
export const CURSOR_INHERIT = '';

/** The last cursor a hover asked for under a held gesture, noted and not shown. */
type SceneCursorHold = { requested: string };

const sceneCursorHolds = new WeakMap<HTMLElement, SceneCursorHold>();

const sceneContainerOf = (event: ScenePointerEvent) =>
  event.target?.getStage()?.container();

/**
 * Points the stage container at a cursor. A konva node carries none of its own,
 * so the container is where the css the dom scene put on an element now lives.
 * Under a hold the cursor is only noted, for the release to write back.
 *
 * @example
 * on:mouseenter={(event) => setSceneCursor(event, CURSOR_POINTER)}
 */
export function setSceneCursor(event: ScenePointerEvent, cursor: string): void {
  const container = sceneContainerOf(event);
  if (!container) return;

  const hold = sceneCursorHolds.get(container);
  if (hold) hold.requested = cursor;
  else container.style.cursor = cursor;
}

/**
 * Keeps the container on a cursor for a mouse gesture, whatever the pointer runs
 * over, and hands back the release that shows what the last hover asked for. A
 * touch has no cursor to keep, so its press holds nothing.
 *
 * @example
 * drag$.subscribe(handleMove).add(holdSceneCursor(event, 'ew-resize'));
 */
export function holdSceneCursor(
  event: ScenePointerEvent,
  cursor: string
): () => void {
  const container = sceneContainerOf(event);
  if (!container || !isMouseEvent(event.evt)) return noop;

  // A press inside another one starts from what that one noted, because the
  // container shows only the cursor the earlier press is holding it on.
  const hold: SceneCursorHold = {
    requested:
      sceneCursorHolds.get(container)?.requested ?? container.style.cursor,
  };
  sceneCursorHolds.set(container, hold);
  container.style.cursor = cursor;

  return () => {
    if (sceneCursorHolds.get(container) !== hold) return;
    sceneCursorHolds.delete(container);
    container.style.cursor = hold.requested;
  };
}
