import {
  clearCache,
  type LayoutCursor,
  layoutNextLine,
  measureNaturalWidth,
  type PreparedTextWithSegments,
  prepareWithSegments,
} from '@chenglou/pretext';

import { recalibrateFonts } from '@/font';

/** What a cell draws in place of the text cut off its end. */
export const ELLIPSIS = '…';

/**
 * The pretext measurements one frame may make. Past it, a text that may
 * overflow is drawn whole and clipped by its column, and the caller draws
 * the frame again so the next one measures what this one could not.
 */
export const MISS_BUDGET = 200;

/** How many times the visible cell count the measure cache holds. */
export const CACHE_FACTOR = 4;

/**
 * The cache a fitter starts with: four times the cells a 1440 by 900 viewport
 * draws with its overscan, about 35 rows by 14 columns, rounded up.
 */
export const DEFAULT_CAPACITY = 2048;

/**
 * How many of pretext's own segment measures a fitter lets its caches keep per
 * entry of its own cache. pretext keeps every segment it measures, per font,
 * until its caches are emptied, and a scroll meets millions of distinct texts.
 */
export const SEGMENT_FACTOR = 16;

/** The segments the grid has handed pretext to measure since its caches were last emptied, counted from what each prepare returned. */
let segmentsMeasured = 0;

/**
 * Empties pretext's caches and has it calibrate every measured font again, as
 * a bound on them or a face that loaded after it measured asks. Call it
 * outside any draw: the calibration reads the DOM.
 */
export function emptyPretextCaches(): void {
  clearCache();
  segmentsMeasured = 0;
  recalibrateFonts();
}

/**
 * Spaces kept as they are, each one measured. pretext collapses runs of them
 * by default, and a canvas draws every one, so the measured width would fall
 * short of the drawn one.
 */
const PREPARE_OPTIONS = { whiteSpace: 'pre-wrap' } as const;

/**
 * The ASCII whitespace a canvas draws as a space: tab, line feed, form feed
 * and carriage return. Any other character, such as a no-break space, is
 * drawn as itself and stays.
 */
const WHITESPACE = /[\t\n\f\r]/;

const WHITESPACE_ALL = /[\t\n\f\r]/g;

const SPACE = 0x20;

/** Where a line starts at the head of a text; layoutNextLine reads it and never writes it. */
const TEXT_START: LayoutCursor = Object.freeze({
  segmentIndex: 0,
  graphemeIndex: 0,
});

/**
 * A cell value as a canvas draws it: each tab, line feed, form feed and
 * carriage return becomes one space, and a run of them stays a run. Measuring
 * and drawing this one string keeps the two in step with each other.
 *
 * @example
 * normalizeCellText('a\tb'); // 'a b'
 */
export function normalizeCellText(text: string): string {
  return WHITESPACE.test(text) ? text.replace(WHITESPACE_ALL, ' ') : text;
}

/**
 * A cell's text as pretext prepares it, in pre-wrap, its segments counted
 * against the bound a fitter's trim keeps pretext's caches under.
 */
export function prepareCellText(
  text: string,
  font: string
): PreparedTextWithSegments {
  const prepared = prepareWithSegments(text, font, PREPARE_OPTIONS);
  segmentsMeasured += prepared.segments.length;

  return prepared;
}

/** A text with the spaces at its end dropped, which an ellipsis would otherwise sit after. */
function trimTrailingSpaces(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === SPACE) end--;

  return end === text.length ? text : text.slice(0, end);
}

/**
 * A text measured wider than a cell once: its prepared segments, its natural
 * width, and the cut last made from it with the content width it was made for.
 */
interface Overflow {
  prepared: PreparedTextWithSegments;
  width: number;
  fitWidth: number;
  fitted: string;
}

/**
 * A cached measurement: the natural width of a text that fit when it was
 * measured, whose segments are dropped, or the overflow a cut is made from.
 */
type Entry = number | Overflow;

/** A map that drops its least recently read entry once it holds its capacity. */
class LruCache<V> {
  private readonly entries = new Map<string, V>();

  constructor(public capacity: number) {}

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }

    return value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    if (this.entries.size >= this.capacity) {
      // A Map iterates in insertion order and a read reinserts, so the first
      // key is the one read longest ago.
      this.entries.delete(this.entries.keys().next().value!);
    }
    this.entries.set(key, value);
  }
}

/** What a scene fits each cell's text through, one fitter per grid. */
export interface TextFitter {
  /**
   * Starts a layer draw: refills the miss budget and binds the font. Call it
   * once per draw before the first sceneFunc, with the maxAdvance measureFont
   * gave the font. A new font empties the cache.
   */
  beginFrame(font: string, maxAdvance: number): void;
  /**
   * The string to draw, left aligned, in a cell whose content box is the width
   * given: the text as a canvas draws it, or its head and an ellipsis when it
   * overflows. Draw it inside the column clip either way.
   */
  fit(text: string, contentWidth: number): string;
  /** Whether this draw left a text unmeasured, so the caller marks the layer dirty again. */
  hasDeferred(): boolean;
  /** Grows the cache to hold four times the cells a viewport shows; it never shrinks. */
  reserve(visibleCells: number): void;
  /**
   * Empties pretext's own caches once the segments measured into them outgrow
   * this fitter's bound, and has it calibrate the fonts measured so far again.
   * Call it outside any draw; what this fitter's cache holds stays valid.
   */
  trim(): void;
  /** Empties this fitter's cache, whose widths a face that loaded since then would draw otherwise. */
  reset(): void;
}

/**
 * A fitter whose cache keys each text by its own string under its font, so a
 * cell builds no key, and holds the capacity given until reserve grows it.
 *
 * @example
 * const fitter = createTextFitter();
 * fitter.beginFrame(font, measureFont(font).maxAdvance);
 * context.fillText(fitter.fit(getCell(row, col), width - 16), x + 8, baseline);
 */
export function createTextFitter(capacity = DEFAULT_CAPACITY): TextFitter {
  let cache = new LruCache<Entry>(capacity);
  /** The font the cache holds widths in, none until a frame binds one or once reset lets them go. */
  let cacheFont: string | undefined;
  let font = '';
  let advance = 0;
  let ellipsisWidth = -1;
  let misses = 0;
  let deferred = false;

  const measureEllipsis = () => {
    if (ellipsisWidth < 0) {
      ellipsisWidth = measureNaturalWidth(prepareCellText(ELLIPSIS, font));
    }

    return ellipsisWidth;
  };

  const cut = (overflow: Overflow, contentWidth: number) => {
    const available = contentWidth - measureEllipsis();
    if (available <= 0) return ELLIPSIS;

    // An overflow is never empty, so its first line always exists.
    const line = layoutNextLine(overflow.prepared, TEXT_START, available)!;

    return trimTrailingSpaces(line.text) + ELLIPSIS;
  };

  return {
    beginFrame(nextFont, maxAdvance) {
      misses = 0;
      deferred = false;
      advance = maxAdvance;
      if (nextFont === cacheFont) return;

      cache = new LruCache<Entry>(capacity);
      cacheFont = nextFont;
      font = nextFont;
      ellipsisWidth = -1;
    },

    fit(text, contentWidth) {
      if (contentWidth <= 0) return '';

      const drawn = normalizeCellText(text);
      if (drawn.length * advance <= contentWidth) return drawn;

      let entry = cache.get(drawn);
      if (
        entry === undefined ||
        (typeof entry === 'number' && entry > contentWidth)
      ) {
        if (misses >= MISS_BUDGET) {
          deferred = true;
          return drawn;
        }

        misses++;
        const prepared = prepareCellText(drawn, font);
        const width = measureNaturalWidth(prepared);
        entry =
          width > contentWidth
            ? { prepared, width, fitWidth: Number.NaN, fitted: drawn }
            : width;
        cache.set(drawn, entry);
      }

      if (typeof entry === 'number' || entry.width <= contentWidth) {
        return drawn;
      }

      if (entry.fitWidth !== contentWidth) {
        entry.fitted = cut(entry, contentWidth);
        entry.fitWidth = contentWidth;
      }

      return entry.fitted;
    },

    hasDeferred() {
      return deferred;
    },

    reserve(visibleCells) {
      capacity = Math.max(capacity, Math.ceil(visibleCells) * CACHE_FACTOR);
      cache.capacity = capacity;
    },

    trim() {
      if (segmentsMeasured > capacity * SEGMENT_FACTOR) emptyPretextCaches();
    },

    reset() {
      cacheFont = undefined;
      ellipsisWidth = -1;
    },
  };
}
