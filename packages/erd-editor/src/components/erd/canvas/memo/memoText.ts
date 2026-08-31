import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';

/** The weight utils/text.ts measures with, which is what the body is drawn in. */
export const MEMO_FONT_WEIGHT = '400';

/**
 * The leading the memo body takes, as konva's multiple of the font size. The
 * DOM textarea left it to line-height normal, and neither a canvas nor a line
 * breaker can resolve a font dependent keyword, so both are pinned to this.
 */
export const MEMO_LINE_HEIGHT = 1.2;

/** The same leading in px, which is what a css line-height and pretext take. */
export const MEMO_LINE_HEIGHT_PX = SCENE_FONT_SIZE * MEMO_LINE_HEIGHT;

/** The css font shorthand the scene text and the overlay editor both resolve to. */
export const MEMO_FONT = `${MEMO_FONT_WEIGHT} ${SCENE_FONT_SIZE}px ${SCENE_FONT_FAMILY}`;

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
  const { lines } = layoutWithLines(prepared, width, MEMO_LINE_HEIGHT_PX);
  const folded = lines.map(line => line.text);

  if (lineCache.size >= CACHE_LIMIT) lineCache.clear();
  lineCache.set(key, folded);

  return folded;
}
