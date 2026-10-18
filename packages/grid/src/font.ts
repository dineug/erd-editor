import { prepare } from '@chenglou/pretext';

/**
 * The face erd-editor draws its canvas cells in, so a grid shown inside the
 * editor reads as the same text. The editor is a sibling the grid cannot
 * import, which is why the stack is written out here.
 */
export const DEFAULT_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Open Sans', system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";

/** The size a grid draws its text at when its host names no font. */
export const DEFAULT_FONT_SIZE = 13;

/** The CSS font shorthand a grid draws and measures with when its host names none. */
export const DEFAULT_FONT = `${DEFAULT_FONT_SIZE}px ${DEFAULT_FONT_FAMILY}`;

/** What a scene needs of a font before it draws a line of it. */
export interface FontMetrics {
  /** The px above the baseline a canvas centres a line by. */
  ascent: number;
  /** The px below the baseline a canvas centres a line by. */
  descent: number;
  /** The widest advance among a Latin, a Hangul, a Han and an emoji glyph. */
  maxAdvance: number;
}

/**
 * The glyphs whose widest advance bounds what one character of a cell can
 * take: a wide Latin capital, a Hangul syllable, a Han character and an
 * emoji. A glyph wider than all four is left to the column clip.
 */
export const ADVANCE_PROBES = ['W', '가', '漢', '😀'] as const;

/** What a realm with no canvas answers, which no cache keeps, so a later call measures. */
const NO_METRICS: FontMetrics = Object.freeze({
  ascent: 0,
  descent: 0,
  maxAdvance: 0,
});

const measured = new Map<string, FontMetrics>();

/**
 * The metrics of a font, measured on the first call for it and kept after.
 * Call it when the grid mounts or its font changes, outside any sceneFunc: it
 * also has pretext measure an emoji, which reads the DOM once per font.
 *
 * @example
 * const { ascent, descent, maxAdvance } = measureFont(DEFAULT_FONT);
 */
export function measureFont(font: string): FontMetrics {
  const held = measured.get(font);
  if (held) return held;
  if (typeof document === 'undefined') return NO_METRICS;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return NO_METRICS;

  context.font = font;
  const metrics = context.measureText('M');
  const ascent =
    metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent =
    metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) {
    return NO_METRICS;
  }

  let maxAdvance = 0;
  for (const probe of ADVANCE_PROBES) {
    maxAdvance = Math.max(maxAdvance, context.measureText(probe).width);
  }

  // pretext calibrates its emoji widths against a DOM span the first time a
  // font meets an emoji. Doing it here keeps that layout read out of a draw.
  prepare(ADVANCE_PROBES.join(''), font);

  const result: FontMetrics = Object.freeze({ ascent, descent, maxAdvance });
  measured.set(font, result);

  return result;
}

/**
 * The widest advance one character of a cell is held to in the font given:
 * text no longer than the content width over it fits without being measured.
 *
 * @example
 * const fits = text.length * maxAdvance(font) <= contentWidth;
 */
export function maxAdvance(font: string): number {
  return measureFont(font).maxAdvance;
}
