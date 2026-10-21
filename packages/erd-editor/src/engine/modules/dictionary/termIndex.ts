import type { Term } from '@/internal-types';

import { DictionaryKind } from './actions';
import { dictionaryCache, normalizeDictionaryName } from './dictionaryIndex';

/** The most terms a logical name cell offers while it is typed. */
export const TERM_COMPLETION_LIMIT = 8;

/**
 * The listed terms sorted by their keys in code unit order, one per name, the
 * first listed answering for it; keys and terms share each position.
 */
export type TermIndex = {
  keys: ReadonlyArray<string>;
  terms: ReadonlyArray<Term>;
};

/** A term name or a typed prefix as completion compares it: composed and in lower case. */
export const toTermKey = (text: string): string =>
  text.normalize('NFC').toLowerCase();

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Sorts the named terms by key, a name in two cases ordered by the name itself. */
export function buildTermIndex(terms: ReadonlyArray<Term>): TermIndex {
  const named = new Map<string, Term>();
  for (const term of terms) {
    const name = normalizeDictionaryName(term.name);
    if (name && !named.has(name)) named.set(name, term);
  }

  const entries = [...named].map(([name, term]) => ({
    key: toTermKey(name),
    name,
    term,
  }));
  entries.sort(
    (a, b) => byCodeUnit(a.key, b.key) || byCodeUnit(a.name, b.name)
  );

  return {
    keys: entries.map(({ key }) => key),
    terms: entries.map(({ term }) => term),
  };
}

/** The term sheet's completion index, built once per generation of the sheet. */
export const getTermIndex = dictionaryCache(
  DictionaryKind.term,
  buildTermIndex
);

/**
 * The terms whose names start with what is typed, at most the limit, in key
 * order. A lower bound search finds the first key, so a query reads at most
 * one key per halving, then one per term it gives and one that ends the run.
 */
export function completeTerms(
  index: TermIndex,
  typed: string,
  limit = TERM_COMPLETION_LIMIT
): Term[] {
  const prefix = toTermKey(typed.trimStart());
  if (!prefix || limit <= 0) return [];

  const { keys, terms } = index;
  let low = 0;
  let high = keys.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (keys[middle] < prefix) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const found: Term[] = [];
  for (
    let position = low;
    position < keys.length && found.length < limit;
    position++
  ) {
    if (!keys[position].startsWith(prefix)) break;
    found.push(terms[position]);
  }
  return found;
}
