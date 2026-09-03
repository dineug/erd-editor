import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

import {
  getSceneFontMetrics,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';

/** The weight utils/text.ts measures with, which is what the body is drawn in. */
export const MEMO_FONT_WEIGHT = '400';

/** The css font shorthand the scene text and the overlay editor both resolve to. */
export const MEMO_FONT = `${MEMO_FONT_WEIGHT} ${SCENE_FONT_SIZE}px ${SCENE_FONT_FAMILY}`;

/** What the leading falls back to where no document can resolve the face. */
const FALLBACK_LINE_HEIGHT_PX = SCENE_FONT_SIZE * 1.2;

/** Lines the probe lays out, so one box's own rounding is divided away. */
const LEADING_PROBE_LINES = 10;

let memoLineHeightPx: number | null = null;

/**
 * The leading a memo body takes, in px, which a css line-height and pretext
 * both take. The dom textarea this replaced left it to line-height normal, so
 * that is the advance, and the only way to it is to lay the lines out.
 *
 * @example
 * const advance = getMemoLineHeightPx();
 */
export function getMemoLineHeightPx(): number {
  if (memoLineHeightPx !== null) return memoLineHeightPx;
  if (typeof document === 'undefined' || !document.body) {
    return FALLBACK_LINE_HEIGHT_PX;
  }

  // A layout metric, not the canvas one: blink resolves normal to the face's
  // layout ascent and descent, which a real chrome puts a whole pixel below
  // what a canvas reports for the same face.
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:absolute;visibility:hidden;top:-10000px;left:0;margin:0;padding:0;border:0;font:${MEMO_FONT};line-height:normal;white-space:pre`;
  probe.textContent = Array.from(
    { length: LEADING_PROBE_LINES },
    () => 'M'
  ).join('\n');
  document.body.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();

  memoLineHeightPx = height / LEADING_PROBE_LINES || FALLBACK_LINE_HEIGHT_PX;

  return memoLineHeightPx;
}

/** The same leading as konva's multiple of the font size, which is what it takes. */
export function getMemoLineHeight(): number {
  return getMemoLineHeightPx() / SCENE_FONT_SIZE;
}

/**
 * The baseline konva draws the first body line on, down from the top of the
 * text node. A canvas has no line box, so the leading and the canvas metrics
 * konva itself measures with are the whole of where that line lands.
 *
 * @example
 * const baseline = getMemoTextBaseline();
 */
export function getMemoTextBaseline(): number {
  const { ascent, descent } = getSceneFontMetrics();

  return getMemoLineHeightPx() / 2 + (ascent - descent) / 2;
}

/**
 * What a textarea's own layout does, restated for pretext. A textarea keeps its
 * runs of spaces and its newlines, and breaks a word too long for the box at a
 * grapheme, which is the pre-wrap plus break-word pair pretext models.
 */
const LAYOUT_OPTIONS = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'normal',
} as const;

/**
 * How many folded bodies are kept before the whole table is dropped. A memo is
 * refolded whenever anything in the editor re-renders it, and only its own
 * value and its own width can change the answer.
 */
const CACHE_LIMIT = 256;

const lineCache = new Map<string, readonly string[]>();

/**
 * The lines a memo body folds into at a box width, the way a textarea folds the
 * same text. Konva breaks a string by rules of its own, so the scene draws
 * these lines rather than handing it the value to wrap.
 *
 * @example
 * const text = layoutMemoLines(memo.value, memo.ui.width).join('\n');
 */
export function layoutMemoLines(
  value: string,
  width: number
): readonly string[] {
  const key = `${width} ${value}`;
  const cached = lineCache.get(key);
  if (cached) return cached;

  const prepared = prepareWithSegments(value, MEMO_FONT, LAYOUT_OPTIONS);
  const { lines } = layoutWithLines(prepared, width, getMemoLineHeightPx());
  const folded = lines.map(line => line.text);

  if (lineCache.size >= CACHE_LIMIT) lineCache.clear();
  lineCache.set(key, folded);

  return folded;
}
