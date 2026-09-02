import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

import {
  getSceneFontMetrics,
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
 * The baseline konva draws the first body line on, down from the top of the
 * text node. A canvas has no line box, so the leading and the font's own ascent
 * and descent are the whole of where that line lands.
 *
 * @example
 * const baseline = getMemoTextBaseline();
 */
export function getMemoTextBaseline(): number {
  const { ascent, descent } = getSceneFontMetrics();

  return MEMO_LINE_HEIGHT_PX / 2 + (ascent - descent) / 2;
}

/** The side of the box the probe below is measured in, exact in dom layout. */
const BASELINE_PROBE_SIZE = 100;

/**
 * Where a dom line box of this leading puts its first baseline. Blink floors
 * the half leading to a whole pixel before it adds the ascent, and no api hands
 * that number out, so the only way to it is to lay one line out and look.
 */
function measureDomTextBaseline(): number {
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;width:${BASELINE_PROBE_SIZE}px;height:${BASELINE_PROBE_SIZE}px`;
  const line = document.createElement('div');
  line.style.cssText = `margin:0;padding:0;border:0;font:${MEMO_FONT};line-height:${MEMO_LINE_HEIGHT_PX}px;white-space:pre-wrap`;
  line.textContent = 'M';
  const marker = document.createElement('span');
  marker.style.cssText =
    'display:inline-block;width:0;height:0;vertical-align:baseline';
  line.appendChild(marker);
  box.appendChild(line);
  document.body.appendChild(box);

  // Every rect below carries the scale of whatever the host page put over the
  // element, which the box of a known side is what divides back out.
  const scale = box.getBoundingClientRect().height / BASELINE_PROBE_SIZE;
  const top = line.getBoundingClientRect().top;
  const bottom = marker.getBoundingClientRect().bottom;
  box.remove();

  return scale ? (bottom - top) / scale : 0;
}

let memoTextSnapOffset: number | null = null;

/**
 * The part of that baseline the dom cannot paint. Blink floors a line box's
 * half leading to a whole pixel and a canvas floors nothing, so the editor
 * hands the difference back to the textarea as a shift.
 *
 * @example
 * transform: `translateY(${getMemoTextSnapOffset()}px)`
 */
export function getMemoTextSnapOffset(): number {
  if (memoTextSnapOffset !== null) return memoTextSnapOffset;

  const { ascent, descent } = getSceneFontMetrics();
  if (typeof document === 'undefined' || (!ascent && !descent)) return 0;

  memoTextSnapOffset = getMemoTextBaseline() - measureDomTextBaseline();

  return memoTextSnapOffset;
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
  const { lines } = layoutWithLines(prepared, width, MEMO_LINE_HEIGHT_PX);
  const folded = lines.map(line => line.text);

  if (lineCache.size >= CACHE_LIMIT) lineCache.clear();
  lineCache.set(key, folded);

  return folded;
}
