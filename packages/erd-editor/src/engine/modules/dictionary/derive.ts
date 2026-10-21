import type { RootState } from '@/engine/state';
import type { Term, ValuesType, Word } from '@/internal-types';

import {
  findTerm,
  getWordIndex,
  normalizeDictionaryName,
  WordIndex,
  WordMarks,
  WordTrieNode,
} from './dictionaryIndex';
import { toLiveDomainId } from './membership';

/** What a stretch of a logical name is to the word sheet. */
export const WordTokenKind = {
  word: 'word',
  synonym: 'synonym',
  forbidden: 'forbidden',
  unregistered: 'unregistered',
} as const;
export type WordTokenKind = ValuesType<typeof WordTokenKind>;

/**
 * A stretch of a logical name and the words it reads as: those so named for
 * a word, those listing it for a synonym or a forbidden word, none for an
 * unregistered stretch.
 */
export type WordToken = {
  text: string;
  kind: WordTokenKind;
  words: ReadonlyArray<Word>;
};

/** Blanks, the underscore, the hyphen, the middle dot and the slash. */
const SEPARATORS = /[\s_\-·/]+/u;

/** The units of a logical name, which the separators bound and no word crosses. */
export const splitNameUnits = (logicalName: string): string[] =>
  normalizeDictionaryName(logicalName)
    .split(SEPARATORS)
    .filter(unit => unit !== '');

const hasMarks = (marks: WordMarks) =>
  marks.words.length > 0 ||
  marks.synonymOf.length > 0 ||
  marks.forbiddenOf.length > 0;

/** The end of the longest marked text starting at the index, and its marks. */
function longestMatch(
  root: WordTrieNode,
  unit: string,
  start: number
): { end: number; marks: WordMarks } | null {
  let node: WordTrieNode | undefined = root;
  let found: { end: number; marks: WordMarks } | null = null;

  for (let index = start; index < unit.length; index++) {
    node = node.next.get(unit.charCodeAt(index));
    if (!node) break;
    if (node.marks && hasMarks(node.marks)) {
      found = { end: index + 1, marks: node.marks };
    }
  }

  return found;
}

/** A standard word before a forbidden one, a forbidden one before a synonym. */
function toToken(text: string, marks: WordMarks): WordToken {
  if (marks.words.length) {
    return { text, kind: WordTokenKind.word, words: marks.words };
  }
  if (marks.forbiddenOf.length) {
    return { text, kind: WordTokenKind.forbidden, words: marks.forbiddenOf };
  }
  return { text, kind: WordTokenKind.synonym, words: marks.synonymOf };
}

const unregistered = (text: string): WordToken => ({
  text,
  kind: WordTokenKind.unregistered,
  words: [],
});

/**
 * Splits a logical name into units at the separators, then reads each unit
 * from the left, taking the longest text the word sheet marks and never going
 * back. What no text matches joins one unregistered stretch until a match.
 */
export function decompose(index: WordIndex, logicalName: string): WordToken[] {
  const tokens: WordToken[] = [];

  for (const unit of splitNameUnits(logicalName)) {
    let pending = 0;
    let position = 0;

    while (position < unit.length) {
      const match = longestMatch(index.root, unit, position);
      if (!match) {
        position++;
        continue;
      }

      if (pending < position) {
        tokens.push(unregistered(unit.slice(pending, position)));
      }
      tokens.push(toToken(unit.slice(position, match.end), match.marks));
      position = match.end;
      pending = position;
    }

    if (pending < unit.length) tokens.push(unregistered(unit.slice(pending)));
  }

  return tokens;
}

/**
 * Joins the words' abbreviations with underscores, trimmed, their case as
 * typed and with no bound on the length; the first listed word of a name
 * answers for it. Any other token, or a word with no abbreviation, gives null.
 */
export function compose(tokens: ReadonlyArray<WordToken>): string | null {
  if (tokens.length === 0) return null;

  const abbreviations: string[] = [];
  for (const token of tokens) {
    if (token.kind !== WordTokenKind.word) return null;

    const abbreviation = token.words[0]?.abbreviation.trim() ?? '';
    if (!abbreviation) return null;
    abbreviations.push(abbreviation);
  }

  return abbreviations.join('_');
}

/** The physical name the word sheet composes for a logical name; null with no word listed. */
export function composeName(
  state: RootState,
  logicalName: string
): string | null {
  const index = getWordIndex(state);
  if (index.byName.size === 0) return null;

  return compose(decompose(index, logicalName));
}

/**
 * What the dictionaries make of a logical name. A term's physical name is ''
 * when the term holds none and the words compose none, so a caller writes no
 * name then; its domain is '' unless the document lists it.
 */
export type DerivedPhysical = {
  physicalName: string;
  domainId: string;
  term: Term | null;
};

/**
 * The term of the logical name first, its physical name composed of words
 * when it holds none, else the composition alone, else null. An empty term
 * sheet matches no term, and an empty word sheet composes nothing.
 */
export function derivePhysical(
  state: RootState,
  logicalName: string
): DerivedPhysical | null {
  const name = normalizeDictionaryName(logicalName);
  if (!name) return null;

  const term = findTerm(state, name);
  if (term) {
    return {
      physicalName:
        term.physicalName.trim() || (composeName(state, name) ?? ''),
      domainId: toLiveDomainId(state, term.domainId),
      term,
    };
  }

  const physicalName = composeName(state, name);
  return physicalName ? { physicalName, domainId: '', term: null } : null;
}
