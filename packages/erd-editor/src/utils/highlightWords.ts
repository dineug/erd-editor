import { escapeRegExp } from 'es-toolkit';

import type { TextRange } from '@/utils/find-replace';

/** A stretch of the text, lit or plain; the chunks of one text run end to end. */
type Chunk = TextRange & {
  highlight: boolean;
};

export type FindChunksArgs = {
  searchWords: string[];
  textToHighlight: string;
  /** Whether a word lights only its own letter case; false when left out. */
  caseSensitive?: boolean;
};

export type FindAllArgs = FindChunksArgs & {
  /** Where the text holds the words, findChunks when left out; the ranges may overlap and come in any order. */
  findChunks?: (args: FindChunksArgs) => TextRange[];
};

/**
 * Every place the text holds a word, word by word and each in order: a word is
 * read as typed, never as a regular expression, and an empty one holds nothing.
 */
export function findChunks({
  searchWords,
  textToHighlight,
  caseSensitive = false,
}: FindChunksArgs): TextRange[] {
  return searchWords
    .filter(word => word)
    .flatMap(word => {
      // No u flag, unlike Find and Replace: a letter folds to its upper case only
      // when that is one UTF-16 unit, and never from beyond ASCII onto it, so ſ
      // never lights an s nor the Kelvin sign a k.
      const pattern = new RegExp(
        escapeRegExp(word),
        caseSensitive ? 'g' : 'gi'
      );

      return Array.from(textToHighlight.matchAll(pattern), match => ({
        start: match.index,
        end: match.index + match[0].length,
      }));
    });
}

/** The ranges in order of where they start, each run of ranges that overlap or touch made one. */
function combineRanges(ranges: TextRange[]): TextRange[] {
  const combined: TextRange[] = [];

  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = combined.at(-1);
    if (last && range.start <= last.end) {
      combined[combined.length - 1] = {
        start: last.start,
        end: Math.max(last.end, range.end),
      };
    } else {
      combined.push(range);
    }
  }

  return combined;
}

/**
 * The whole text as chunks: one lit chunk for each run of matches that overlap
 * or touch, so two words side by side light as one, and plain chunks between
 * them. An empty text has none.
 */
export function findAll({
  searchWords,
  textToHighlight,
  caseSensitive,
  findChunks: find = findChunks,
}: FindAllArgs): Chunk[] {
  const chunks: Chunk[] = [];
  const append = (start: number, end: number, highlight: boolean) => {
    if (end > start) chunks.push({ start, end, highlight });
  };
  let lastIndex = 0;

  for (const { start, end } of combineRanges(
    find({ searchWords, textToHighlight, caseSensitive })
  )) {
    append(lastIndex, start, false);
    append(start, end, true);
    lastIndex = end;
  }
  append(lastIndex, textToHighlight.length, false);

  return chunks;
}
