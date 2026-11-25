import { CELL_FONT_SIZE } from '@/constants/layout';

import type { ToWidth } from './textWidth';

/** What konva and the scene read off a measurement: the advance and the face's box. */
export type TableTextMetrics = Pick<
  TextMetrics,
  'width' | 'fontBoundingBoxAscent' | 'fontBoundingBoxDescent'
>;

/** One face as the table holds it, every figure in thousandths of an em. */
type TableFace = {
  /** The advance of each printable ASCII character, space to tilde. */
  ascii: ReadonlyArray<number>;
  /** The advance of a character the table neither lists nor classes. */
  other: number;
  ascent: number;
  descent: number;
};

/**
 * The text face's ASCII advances at 12 px, regular then bold, read off the
 * editor's own font stack in Chromium. Measured rather than copied from a font
 * file: src/services/AGENTS.md says how and when, and why 12 px.
 */
const TEXT_REGULAR = [
  281, 311, 478, 630, 630, 925, 711, 297, 382, 382, 472, 630, 297, 472, 297,
  305, 630, 464, 604, 627, 644, 618, 637, 569, 639, 637, 297, 297, 630, 630,
  630, 513, 918, 674, 657, 716, 727, 596, 572, 747, 742, 268, 538, 659, 568,
  874, 742, 771, 635, 771, 653, 637, 634, 737, 674, 968, 679, 655, 662, 382,
  305, 382, 630, 583, 500, 552, 614, 560, 614, 571, 362, 609, 588, 247, 247,
  543, 253, 870, 583, 591, 610, 609, 381, 523, 363, 583, 542, 774, 524, 543,
  539, 382, 259, 382, 630,
];

const TEXT_BOLD = [
  258, 356, 569, 671, 671, 1036, 745, 348, 429, 429, 484, 671, 348, 484, 348,
  334, 685, 512, 643, 669, 687, 664, 684, 604, 694, 684, 348, 348, 671, 671,
  671, 557, 927, 732, 693, 741, 748, 622, 598, 760, 783, 318, 601, 709, 595,
  907, 768, 787, 674, 787, 694, 675, 660, 760, 721, 1009, 729, 708, 676, 429,
  334, 429, 671, 627, 500, 590, 651, 587, 651, 601, 408, 646, 632, 287, 287,
  602, 295, 932, 627, 620, 647, 647, 435, 566, 413, 627, 583, 847, 581, 597,
  566, 429, 299, 429, 671,
];

/** The monospace face's one advance, which every ASCII character takes. */
const CODE_ADVANCE = 602;

const REGULAR_FACE: TableFace = {
  ascii: TEXT_REGULAR,
  // The mean of the row it stands for, as is the bold face's.
  other: 561,
  ascent: 1000,
  descent: 250,
};

const BOLD_FACE: TableFace = { ...REGULAR_FACE, ascii: TEXT_BOLD, other: 601 };

const CODE_FACE: TableFace = {
  ascii: Array.from(TEXT_REGULAR, () => CODE_ADVANCE),
  other: CODE_ADVANCE,
  ascent: 917,
  descent: 250,
};

/** A wide East Asian character takes a whole em, a little past what a system face gives it. */
const WIDE_ADVANCE = 1000;

/** An emoji takes an em and a quarter, as Chromium lays one out beside the text face. */
const EMOJI_ADVANCE = 1250;

/**
 * The margin toWidth adds over the table, since a reader's machine sets the
 * text in a face the table never measured; src/services/AGENTS.md has what it
 * was measured against.
 */
export const TO_WIDTH_MARGIN = 1.15;

/** The two px utils/text.ts adds to every measurement it hands the layout. */
const TEXT_PADDING = 2;

/** A canvas context's font before anything sets one. */
const DEFAULT_SIZE = 10;

const FONT_SIZE = /(\d+(?:\.\d+)?)px/;

const BOLD_WEIGHT = /(?:^|\s)(?:bold|bolder|[6-9]00)\s/;

const MONOSPACE = /\bmonospace\b/;

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

const EMOJI = /\p{Emoji_Presentation}|\u{FE0F}/u;

const NO_ADVANCE = /^[\p{M}\p{Cf}\p{Cc}]/u;

/** The code points East Asian width calls wide or full, as half-open ranges. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x1160],
  [0x2e80, 0x303f],
  [0x3041, 0x3400],
  [0x3400, 0x4dc0],
  [0x4e00, 0xa4d0],
  [0xa960, 0xa980],
  [0xac00, 0xd7a4],
  [0xf900, 0xfb00],
  [0xfe10, 0xfe1a],
  [0xfe30, 0xfe70],
  [0xff00, 0xff61],
  [0xffe0, 0xffe7],
  [0x1b000, 0x1b300],
  [0x20000, 0x3fffe],
];

const isWide = (code: number) =>
  WIDE_RANGES.some(([start, end]) => code >= start && code < end);

const asciiAdvance = (face: TableFace, code: number) =>
  code >= 0x20 && code <= 0x7e ? face.ascii[code - 0x20] : undefined;

let graphemes: Intl.Segmenter | undefined;

/** One character as a reader sees it, a base and its marks or a whole emoji sequence. */
function graphemeAdvance(grapheme: string, face: TableFace): number {
  if (EMOJI.test(grapheme)) return EMOJI_ADVANCE;

  const code = grapheme.codePointAt(0) ?? 0;
  const ascii = asciiAdvance(face, code);
  if (ascii !== undefined) return ascii;
  if (isWide(code)) return WIDE_ADVANCE;
  if (NO_ADVANCE.test(grapheme)) return 0;

  // An accented Latin letter is about as wide as the letter it decomposes to.
  const base = grapheme.normalize('NFD').codePointAt(0) ?? 0;
  return asciiAdvance(face, base) ?? face.other;
}

/** A string's advance in thousandths of an em of the face given. */
function advanceOf(text: string, face: TableFace): number {
  let total = 0;
  if (PRINTABLE_ASCII.test(text)) {
    for (let index = 0; index < text.length; index++) {
      total += face.ascii[text.charCodeAt(index) - 0x20];
    }
    return total;
  }

  graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const { segment } of graphemes.segment(text)) {
    total += graphemeAdvance(segment, face);
  }
  return total;
}

/** The face a css font shorthand names: the code face for a monospace stack, else the text face's weight. */
function faceOf(font: string): TableFace {
  if (MONOSPACE.test(font)) return CODE_FACE;
  return BOLD_WEIGHT.test(font) ? BOLD_FACE : REGULAR_FACE;
}

/**
 * What a canvas would measure for a string in a css font shorthand, read off
 * the width table: konva lays scene text out by it, and pretext a memo's body,
 * where a realm with no font engine has no canvas of its own to ask.
 *
 * @example
 * measureTableText('users', 'normal normal 12px sans-serif').width;
 */
export function measureTableText(text: string, font: string): TableTextMetrics {
  const size = Number(FONT_SIZE.exec(font)?.[1] ?? DEFAULT_SIZE);
  const face = faceOf(font);
  const em = (units: number) => (units / 1000) * size;

  return {
    width: em(advanceOf(text, face)),
    fontBoundingBoxAscent: em(face.ascent),
    fontBoundingBoxDescent: em(face.descent),
  };
}

/**
 * The room a table reserves for a string, as utils/text.ts gives it, off the
 * width table with its margin. Konva measures the same table without one, so
 * text drawn in that room is never cut short.
 *
 * @example
 * const width = tableToWidth('users');
 */
export const tableToWidth: ToWidth = text =>
  Math.round(
    (advanceOf(text, REGULAR_FACE) / 1000) * CELL_FONT_SIZE * TO_WIDTH_MARGIN
  ) + TEXT_PADDING;
