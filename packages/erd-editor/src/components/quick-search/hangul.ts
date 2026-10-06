import { disassembleToGroups } from 'es-hangul';

import type { Matcher, TextRange } from '@/utils/find-replace';
import { findChunks, type FindChunksArgs } from '@/utils/highlightWords';

/** A Hangul syllable, compatibility jamo or conjoining jamo: what turns a keyword into a Hangul search. */
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/;

/** A keyword of initial consonants alone, spaces between them allowed, such as ㅅㅇㅈ for 사용자. */
const CONSONANTS_ONLY = /^[ㄱ-ㅎ\s]+$/;

/** Conjoining jamo, which spell each syllable of a text stored decomposed (NFD), as macOS names files. */
const CONJOINING = /[ᄀ-ᇿ]/;

/** The compatibility letter of each modern conjoining initial from U+1100 on, as getChoseong maps them. */
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

const isSyllable = (code: number) => code >= 0xac00 && code <= 0xd7a3;

const isConsonant = (code: number) => code >= 0x3131 && code <= 0x314e;

type Letters = {
  /** The text with its conjoining jamo composed into syllables as NFC composes them, a lone initial made a compatibility letter. */
  text: string;
  /** Where in the source each code point of the text starts, and last the source's length. */
  at: number[];
};

/**
 * A decomposed text composed letter by letter, each letter keeping where its
 * jamo start in the source, so a highlight covers a syllable's every jamo.
 */
function compose(source: string): Letters {
  let text = '';
  const at: number[] = [];
  let index = 0;

  while (index < source.length) {
    const code = source.codePointAt(index) as number;
    const initial = code - 0x1100;
    // Past the text's end these read NaN, which no bound holds.
    const vowel = source.charCodeAt(index + 1) - 0x1161;
    const final = (offset: number) => source.charCodeAt(offset) - 0x11a7;
    let letter = String.fromCodePoint(code);
    let length = letter.length;

    if (initial >= 0 && initial < 19 && vowel >= 0 && vowel < 21) {
      const open = 0xac00 + (initial * 21 + vowel) * 28;
      const tail = final(index + 2);
      const closed = tail > 0 && tail < 28;
      letter = String.fromCharCode(closed ? open + tail : open);
      length = closed ? 3 : 2;
    } else if (initial >= 0 && initial < 19) {
      letter = INITIALS[initial];
    } else if (isSyllable(code) && (code - 0xac00) % 28 === 0) {
      const tail = final(index + 1);
      if (tail > 0 && tail < 28) {
        letter = String.fromCharCode(code + tail);
        length = 2;
      }
    }

    text += letter;
    at.push(index);
    index += length;
  }
  at.push(source.length);

  return { text, at };
}

export type HangulForms = {
  /** The text spelled in jamo letter by letter and lower-cased, as disassemble spells it. */
  jamo: string;
  /** The initial of each syllable and each lone consonant, a cluster split in two, run together without the spaces. */
  choseong: string;
};

type Spelling = HangulForms & {
  /** Where in the text the letter each unit of the jamo came from starts. */
  jamoAt: number[];
  /** Where in the text the letter each unit of the jamo came from ends. */
  jamoTo: number[];
  /** Where in the text the letter each consonant of the choseong came from starts. */
  choseongAt: number[];
  /** Where in the text the letter each consonant of the choseong came from ends. */
  choseongTo: number[];
};

/** One pass over a text's letters for both forms, and where each unit came from when a highlight needs it. */
function spell(text: string, withOffsets: boolean): Spelling {
  const letters = CONJOINING.test(text) ? compose(text) : null;
  const spelled = letters ? letters.text : text;
  const groups = disassembleToGroups(spelled);
  const jamoAt: number[] = [];
  const jamoTo: number[] = [];
  const choseongAt: number[] = [];
  const choseongTo: number[] = [];
  let jamo = '';
  let choseong = '';
  let start = 0;
  let index = 0;

  // disassembleToGroups walks the text by code point too, one group a letter.
  for (const letter of spelled) {
    const group = groups[index];
    const from = letters ? letters.at[index] : start;
    const to = letters ? letters.at[index + 1] : start + letter.length;
    const code = letter.charCodeAt(0);
    const unit = group.join('').toLowerCase();
    // A lone cluster counts as the two consonants it joins, since a Windows
    // IME composes ㄱ then ㅅ into ㄳ, which no syllable has as its initial.
    const initial = isSyllable(code) ? group[0] : isConsonant(code) ? unit : '';

    jamo += unit;
    choseong += initial;
    if (withOffsets) {
      for (let offset = 0; offset < unit.length; offset++) {
        jamoAt.push(from);
        jamoTo.push(to);
      }
      for (let offset = 0; offset < initial.length; offset++) {
        choseongAt.push(from);
        choseongTo.push(to);
      }
    }
    start += letter.length;
    index++;
  }

  return { jamo, choseong, jamoAt, jamoTo, choseongAt, choseongTo };
}

let keptForms = new Map<string, HangulForms>();

/** A text's forms, spelled once and kept until the palette next opens or closes, since it reads every field again on each keystroke. */
export function hangulFormsOf(text: string): HangulForms {
  let forms = keptForms.get(text);
  if (!forms) {
    const { jamo, choseong } = spell(text, false);
    forms = { jamo, choseong };
    keptForms.set(text, forms);
  }
  return forms;
}

/** Lets go of every form kept, as the palette opens and closes: they last one open and outlive no text the document dropped. */
export function clearHangulForms(): void {
  keptForms = new Map();
}

export type HangulQuery = {
  /** The keyword spelled in jamo, which the text's jamo has to hold. */
  jamo: string;
  /** The consonants of a keyword typed as initials alone, a cluster split in two, spaces dropped; null for any other keyword. */
  choseong: string | null;
};

/**
 * How a keyword reads as a Hangul search, or null when it holds no Hangul and
 * the palette matches as it always has.
 *
 * @example
 * hangulQueryOf('ㅅㅇㅈ'); // { jamo: 'ㅅㅇㅈ', choseong: 'ㅅㅇㅈ' }
 * hangulQueryOf('ㅄ'); // { jamo: 'ㅂㅅ', choseong: 'ㅂㅅ' }
 * hangulQueryOf('사요'); // { jamo: 'ㅅㅏㅇㅛ', choseong: null }
 */
export function hangulQueryOf(keyword: string): HangulQuery | null {
  const text = keyword.trim();
  if (!HANGUL.test(text)) return null;

  const { jamo, choseong } = spell(text, false);
  return { jamo, choseong: CONSONANTS_ONLY.test(text) ? choseong : null };
}

/** How closely a text holds a Hangul keyword: all of it, from its start, or somewhere inside. */
export const HangulTier = {
  exact: 0,
  prefix: 1,
  inside: 2,
} as const;
export type HangulTier = (typeof HangulTier)[keyof typeof HangulTier];

function tierOf(form: string, needle: string): HangulTier | null {
  if (form === needle) return HangulTier.exact;
  if (form.startsWith(needle)) return HangulTier.prefix;
  return form.includes(needle) ? HangulTier.inside : null;
}

/**
 * How closely a text holds a Hangul keyword, by its jamo or, for a keyword of
 * initials, by the initials of its syllables; null when it holds it neither way.
 */
export function hangulTier(
  text: string,
  query: HangulQuery
): HangulTier | null {
  if (!HANGUL.test(text)) return null;

  const forms = hangulFormsOf(text);
  const byJamo = tierOf(forms.jamo, query.jamo);
  const byChoseong =
    query.choseong === null ? null : tierOf(forms.choseong, query.choseong);

  if (byJamo === null) return byChoseong;
  return byChoseong === null || byJamo < byChoseong ? byJamo : byChoseong;
}

/** Every place a form holds the needle, each widened to the whole letters its units came from. */
function rangesIn(
  form: string,
  at: number[],
  to: number[],
  needle: string
): TextRange[] {
  const ranges: TextRange[] = [];
  let index = form.indexOf(needle);

  while (index !== -1) {
    ranges.push({ start: at[index], end: to[index + needle.length - 1] });
    index = form.indexOf(needle, index + needle.length);
  }

  return ranges;
}

/**
 * Every place a text holds a Hangul keyword, as whole letters of the text in
 * order of where they start, so a jamo typed mid-syllable covers the syllables
 * it spells: 상 in 사용자 covers 사용.
 */
export function hangulRanges(text: string, query: HangulQuery): TextRange[] {
  if (!HANGUL.test(text)) return [];

  const spelling = spell(text, true);
  const ranges = rangesIn(
    spelling.jamo,
    spelling.jamoAt,
    spelling.jamoTo,
    query.jamo
  );
  if (query.choseong !== null) {
    ranges.push(
      ...rangesIn(
        spelling.choseong,
        spelling.choseongAt,
        spelling.choseongTo,
        query.choseong
      )
    );
  }

  return ranges.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** How a text holds the keyword: as typed, which Find and Replace finds too, and where; or by its Hangul letters alone, and how closely. */
export type TextHit =
  | (TextRange & { literal: true })
  | { literal: false; tier: HangulTier };

/**
 * Whether a text holds the keyword: as typed, or failing that by its Hangul
 * letters, which only the palette reads. Where those letters lie waits for
 * hitRange, which spells the text again.
 */
export function matchText(
  text: string,
  matcher: Matcher,
  hangul: HangulQuery | null
): TextHit | null {
  const [range] = matcher.find(text);
  if (range) return { ...range, literal: true };
  if (!hangul) return null;

  const tier = hangulTier(text, hangul);
  return tier === null ? null : { literal: false, tier };
}

/**
 * The first place a text holds a hit, which for one its Hangul letters hold
 * spells the text again, so a list reads it only for the rows it shows.
 */
export function hitRange(
  text: string,
  hit: TextHit,
  hangul: HangulQuery | null
): TextRange {
  if (hit.literal) return { start: hit.start, end: hit.end };

  // Only a Hangul keyword makes a hit that is not literal.
  const [range] = hangulRanges(text, hangul as HangulQuery);
  return range;
}

/**
 * Hits in a Hangul search's order: those holding the keyword as typed first,
 * as they came, the way a search without Hangul lists them, then those only its
 * letters hold, closest first and as they came within a tier.
 */
export function rankHits<T extends { hit: TextHit }>(hits: T[]): T[] {
  const rank = ({ hit }: T) => (hit.literal ? -1 : hit.tier);
  return [...hits].sort((a, b) => rank(a) - rank(b));
}

/**
 * The ranges a palette row lights up: each word where the text holds it as
 * typed, and a Hangul word where the text holds it by its letters, widened to
 * whole syllables. HighlightedText merges the ones that overlap or touch.
 */
export function findPaletteChunks(args: FindChunksArgs): TextRange[] {
  const spelled = args.searchWords.flatMap(word => {
    const query = hangulQueryOf(word);
    return query ? hangulRanges(args.textToHighlight, query) : [];
  });

  return [...findChunks(args), ...spelled];
}
