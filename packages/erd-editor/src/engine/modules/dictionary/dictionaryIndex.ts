import { compareByOrder } from '@dineug/erd-editor-schema';

import type { RootState } from '@/engine/state';
import type { Domain, Term, Word } from '@/internal-types';

import { DictionaryKind } from './actions';

const COLLECTION_KEY = {
  [DictionaryKind.word]: 'wordEntities',
  [DictionaryKind.term]: 'termEntities',
  [DictionaryKind.domain]: 'domainEntities',
} as const;

const IDS_KEY = {
  [DictionaryKind.word]: 'wordIds',
  [DictionaryKind.term]: 'termIds',
  [DictionaryKind.domain]: 'domainIds',
} as const;

/** The row each dictionary holds. */
export type DictionaryRowOf = {
  [DictionaryKind.word]: Word;
  [DictionaryKind.term]: Term;
  [DictionaryKind.domain]: Domain;
};

/**
 * A name as every dictionary lookup compares it: trimmed and composed, its
 * case kept, so a term matches a logical name typed in either Unicode form.
 */
export const normalizeDictionaryName = (name: string): string =>
  name.trim().normalize('NFC');

/** The names a comma separated field lists, each normalized, none empty. */
export const splitDictionaryList = (text: string): string[] =>
  text
    .split(',')
    .map(normalizeDictionaryName)
    .filter(name => name !== '');

const generations = new WeakMap<object, number>();

/**
 * Marks a dictionary as written, so each index built over it is built again
 * on its next read. The add, update and remove reducers call it; a load
 * brings new collections, which no index was built over yet.
 */
export function raiseDictionaryGeneration(
  state: RootState,
  kind: DictionaryKind
) {
  const collection = state.collections[COLLECTION_KEY[kind]];
  generations.set(collection, (generations.get(collection) ?? 0) + 1);
}

type Held<T> = {
  generation: number;
  ids: string[];
  length: number;
  value: T;
};

/**
 * Keeps what the build makes of a dictionary per collection until its
 * generation moves or its id list changes, so a table or column edit builds
 * nothing again. The value is the same object until then.
 */
function heldPerSheet<K extends DictionaryKind, T>(
  kind: K,
  build: (
    state: RootState,
    collection: Record<string, DictionaryRowOf[K] | undefined>,
    ids: string[]
  ) => T
): (state: RootState) => T {
  const held = new WeakMap<object, Held<T>>();

  return state => {
    const collection = state.collections[COLLECTION_KEY[kind]] as Record<
      string,
      DictionaryRowOf[K] | undefined
    >;
    const ids = state.doc[IDS_KEY[kind]];
    const generation = generations.get(collection) ?? 0;
    const entry = held.get(collection);

    if (
      entry &&
      entry.generation === generation &&
      entry.ids === ids &&
      entry.length === ids.length
    ) {
      return entry.value;
    }

    const value = build(state, collection, ids);
    held.set(collection, { generation, ids, length: ids.length, value });
    return value;
  };
}

/** A sheet's listed rows in key order, those of one key by id (compareByOrder). */
function sortRows<Row extends DictionaryRowOf[DictionaryKind]>(
  _state: RootState,
  collection: Record<string, Row | undefined>,
  ids: string[]
): ReadonlyArray<Row> {
  const rows: Row[] = [];
  for (const id of ids) {
    const row = collection[id];
    if (row) rows.push(row);
  }
  return rows.sort(compareByOrder);
}

const SHEET_ROWS = {
  [DictionaryKind.word]: heldPerSheet(DictionaryKind.word, sortRows),
  [DictionaryKind.term]: heldPerSheet(DictionaryKind.term, sortRows),
  [DictionaryKind.domain]: heldPerSheet(DictionaryKind.domain, sortRows),
};

/**
 * A dictionary's listed rows in the order its sheet, its file and every reader
 * show them: by order key. Built once per write of the sheet; never mutate it.
 */
export const orderedDictionaryRows = <K extends DictionaryKind>(
  state: RootState,
  kind: K
): ReadonlyArray<DictionaryRowOf[K]> =>
  SHEET_ROWS[kind](state) as ReadonlyArray<DictionaryRowOf[K]>;

/**
 * A reader of what the build makes of a dictionary's listed rows in sheet
 * order, kept until the sheet is written again (heldPerSheet).
 */
export function dictionaryCache<K extends DictionaryKind, T>(
  kind: K,
  build: (rows: ReadonlyArray<DictionaryRowOf[K]>) => T
): (state: RootState) => T {
  return heldPerSheet(kind, state => build(orderedDictionaryRows(state, kind)));
}

/** A sheet's listed rows, and those of each normalized name, both in sheet order. */
export type NameIndex<Row> = {
  rows: ReadonlyArray<Row>;
  byName: ReadonlyMap<string, ReadonlyArray<Row>>;
};

/** What a word sheet says of one text: the words so named, and those listing it. */
export type WordMarks = {
  words: Word[];
  synonymOf: Word[];
  forbiddenOf: Word[];
};

/** A node of the word trie, keyed by UTF-16 code unit. */
export type WordTrieNode = {
  next: Map<number, WordTrieNode>;
  marks?: WordMarks;
};

/** The word sheet's names, and a trie over them, its synonyms and its forbidden words. */
export type WordIndex = NameIndex<Word> & {
  root: WordTrieNode;
};

const createNode = (): WordTrieNode => ({ next: new Map() });

function marksAt(root: WordTrieNode, text: string): WordMarks {
  let node = root;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    let next = node.next.get(code);
    if (!next) {
      next = createNode();
      node.next.set(code, next);
    }
    node = next;
  }

  node.marks ??= { words: [], synonymOf: [], forbiddenOf: [] };
  return node.marks;
}

function pushOnce<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}

function groupByName<Row extends { name: string }>(
  rows: ReadonlyArray<Row>,
  each?: (row: Row, name: string) => void
): Map<string, Row[]> {
  const byName = new Map<string, Row[]>();

  for (const row of rows) {
    const name = normalizeDictionaryName(row.name);
    if (!name) continue;

    const named = byName.get(name);
    if (named) {
      named.push(row);
    } else {
      byName.set(name, [row]);
    }
    each?.(row, name);
  }

  return byName;
}

/** The rows by name; a row without a name is in no group and matches nothing. */
export const buildNameIndex = <Row extends { name: string }>(
  rows: ReadonlyArray<Row>
): NameIndex<Row> => ({ rows, byName: groupByName(rows) });

/**
 * Marks each word's name, synonyms and forbidden words on the trie, in sheet
 * order. A word without a name lists nothing, since it names no standard word
 * to suggest, and a synonym equal to its own word's name is passed over.
 */
export function buildWordIndex(words: ReadonlyArray<Word>): WordIndex {
  const root = createNode();
  const byName = groupByName(words, (word, name) => {
    marksAt(root, name).words.push(word);

    for (const synonym of splitDictionaryList(word.synonyms)) {
      if (synonym !== name) pushOnce(marksAt(root, synonym).synonymOf, word);
    }
    for (const forbidden of splitDictionaryList(word.forbiddenWords)) {
      if (forbidden !== name) {
        pushOnce(marksAt(root, forbidden).forbiddenOf, word);
      }
    }
  });

  return { rows: words, byName, root };
}

/** The word sheet's index, built once per generation of the sheet. */
export const getWordIndex = dictionaryCache(
  DictionaryKind.word,
  buildWordIndex
);

/** The term sheet's names, built once per generation of the sheet. */
export const getTermNames: (state: RootState) => NameIndex<Term> =
  dictionaryCache(DictionaryKind.term, buildNameIndex);

/** The domain sheet's names, built once per generation of the sheet. */
export const getDomainNames: (state: RootState) => NameIndex<Domain> =
  dictionaryCache(DictionaryKind.domain, buildNameIndex);

/** The first listed term of the name, compared trimmed, composed and case kept. */
export const findTerm = (state: RootState, name: string): Term | undefined =>
  getTermNames(state).byName.get(normalizeDictionaryName(name))?.[0];

/** The first listed domain of the name, compared as a term's is. */
export const findDomain = (
  state: RootState,
  name: string
): Domain | undefined =>
  getDomainNames(state).byName.get(normalizeDictionaryName(name))?.[0];
