import { TextFontFamily } from '@/styles/fonts.styles';

/** How the editor measures a string, which is what a table reserves room by. */
export type ToWidth = (text: string) => number;

/** The two px utils/text.ts adds to every measurement it hands the layout. */
const TEXT_PADDING = 2;

/** The shorthand utils/text.ts sets on the context it measures with. */
export const SCENE_FONT = `400 12px ${TextFontFamily}`;

/**
 * Strings a divergence in font resolution shows up in. Latin covers the head of
 * the family list, the ideographs cover whatever the host falls through to for
 * them, and the punctuation covers a face that carries only part of the range.
 */
export const FONT_PROBE_TEXTS = [
  'ERD editor 0123456789',
  '가나다 漢字 テスト',
  '—…€· iIlL1',
] as const;

/**
 * The same measurement utils/text.ts makes, on a canvas no document holds. A
 * realm off the screen has no element to fall back to, so a realm with no 2d
 * context has no way to lay a document out and says so rather than guessing.
 */
export function createOffscreenToWidth(): ToWidth | null {
  if (typeof OffscreenCanvas === 'undefined') return null;

  const context = new OffscreenCanvas(1, 1).getContext('2d');
  if (!context) return null;

  context.font = SCENE_FONT;

  return text => Math.round(context.measureText(text).width) + TEXT_PADDING;
}

/**
 * What the probe strings measure under one realm's font resolution. Comparing
 * two of these is the only gate that fires: a worker's fonts.load resolves for
 * a family it does not have, and fonts.check answers true for one nobody has.
 *
 * @example
 * measureFontProbe(toWidth);
 */
export function measureFontProbe(toWidth: ToWidth): number[] {
  return FONT_PROBE_TEXTS.map(text => toWidth(text));
}

/** Whether two realms lay the probe strings out to the same pixel. */
export function sameFontProbe(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((width, index) => width === b[index]);
}
