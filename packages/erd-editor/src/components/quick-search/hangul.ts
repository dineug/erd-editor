import { disassembleToGroups } from 'es-hangul';
import { type Chunk, findAll, type FindChunksArgs } from 'highlight-words-core';

import type { Matcher, TextRange } from '@/utils/find-replace';

/** A Hangul syllable, compatibility jamo or conjoining jamo: what turns a keyword into a Hangul search. */
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/;

/** A keyword of initial consonants alone, spaces between them allowed, such as ㅅㅇㅈ for 사용자. */
const CONSONANTS_ONLY = /^[ㄱ-ㅎ\s]+$/;

const WHITESPACE = /\s+/g;

const isSyllable = (code: number) => code >= 0xac00 && code <= 0xd7a3;

const isConsonant = (code: number) => code >= 0x3131 && code <= 0x314e;

export type HangulForms = {
  /** The text spelled in jamo letter by letter and lower-cased, as disassemble spells it. */
  jamo: string;
  /** The initial of each syllable and each lone consonant, run together, as getChoseong reads them without the spaces. */
  choseong: string;
};

type Spelling = HangulForms & {
  /** Where in the text the letter each unit of the jamo came from starts. */
  jamoAt: number[];
  /** Where in the text the letter each consonant of the choseong came from starts. */
  choseongAt: number[];
};

/** One pass over a text's letters for both forms, and where each unit came from when a highlight needs it. */
function spell(text: string, withOffsets: boolean): Spelling {
  const groups = disassembleToGroups(text);
  const jamoAt: number[] = [];
  const choseongAt: number[] = [];
  let jamo = '';
  let choseong = '';
  let start = 0;
  let index = 0;

  // disassembleToGroups walks the text by code point too, one group a letter.
  for (const letter of text) {
    const group = groups[index++];
    const code = letter.charCodeAt(0);
    const unit = group.join('').toLowerCase();
    const initial = isSyllable(code)
      ? group[0]
      : isConsonant(code)
        ? letter
        : '';

    jamo += unit;
    choseong += initial;
    if (withOffsets) {
      for (let offset = 0; offset < unit.length; offset++) jamoAt.push(start);
      if (initial) choseongAt.push(start);
    }
    start += letter.length;
  }

  return { jamo, choseong, jamoAt, choseongAt };
}

/** How many texts keep their forms, dropped all at once past it: more than every field of a large schema. */
export const HANGUL_CACHE_LIMIT = 50_000;

const cache = new Map<string, HangulForms>();

/** A text's forms, spelled once and kept, since the palette reads every field again on each keystroke. */
export function hangulFormsOf(text: string): HangulForms {
  const cached = cache.get(text);
  if (cached) return cached;

  if (cache.size >= HANGUL_CACHE_LIMIT) cache.clear();
  const { jamo, choseong } = spell(text, false);
  const forms = { jamo, choseong };
  cache.set(text, forms);
  return forms;
}

export type HangulQuery = {
  /** The keyword spelled in jamo, which the text's jamo has to hold. */
  jamo: string;
  /** The consonants of a keyword typed as initials alone, spaces dropped; null for any other keyword. */
  choseong: string | null;
};

/**
 * How a keyword reads as a Hangul search, or null when it holds no Hangul and
 * the palette matches as it always has.
 *
 * @example
 * hangulQueryOf('ㅅㅇㅈ'); // { jamo: 'ㅅㅇㅈ', choseong: 'ㅅㅇㅈ' }
 * hangulQueryOf('사요'); // { jamo: 'ㅅㅏㅇㅛ', choseong: null }
 */
export function hangulQueryOf(keyword: string): HangulQuery | null {
  const text = keyword.trim();
  if (!HANGUL.test(text)) return null;

  return {
    jamo: spell(text, false).jamo,
    choseong: CONSONANTS_ONLY.test(text) ? text.replace(WHITESPACE, '') : null,
  };
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
  text: string,
  form: string,
  at: number[],
  needle: string
): TextRange[] {
  const ranges: TextRange[] = [];
  let index = form.indexOf(needle);

  while (index !== -1) {
    const start = at[index];
    const last = at[index + needle.length - 1];
    const width = (text.codePointAt(last) ?? 0) > 0xffff ? 2 : 1;
    ranges.push({ start, end: last + width });
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
  const ranges = rangesIn(text, spelling.jamo, spelling.jamoAt, query.jamo);
  if (query.choseong !== null) {
    ranges.push(
      ...rangesIn(text, spelling.choseong, spelling.choseongAt, query.choseong)
    );
  }

  return ranges.sort((a, b) => a.start - b.start || a.end - b.end);
}

export type TextHit = TextRange & {
  /** Whether the text holds the keyword as typed, which Find and Replace finds too. */
  literal: boolean;
};

/**
 * The first place a text holds the keyword: as typed, or failing that by its
 * Hangul letters, which only the palette reads.
 */
export function matchText(
  text: string,
  matcher: Matcher,
  hangul: HangulQuery | null
): TextHit | null {
  const [range] = matcher.find(text);
  if (range) return { ...range, literal: true };
  if (!hangul || hangulTier(text, hangul) === null) return null;

  const [spelled] = hangulRanges(text, hangul);
  return { ...spelled, literal: false };
}

/**
 * The chunks a palette row lights up: each word where the text holds it as
 * typed, and a Hangul word where the text holds it by its letters, widened to
 * whole syllables. HighlightedText merges the ones that overlap.
 */
export function findPaletteChunks(args: FindChunksArgs): Chunk[] {
  const typed = findAll(args).filter(chunk => chunk.highlight);
  const spelled = args.searchWords.flatMap(word => {
    const query = hangulQueryOf(word);
    return query ? hangulRanges(args.textToHighlight, query) : [];
  });

  return [...typed, ...spelled.map(range => ({ ...range, highlight: true }))];
}
