import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Domain, Term, ValuesType, Word } from '@/internal-types';

export const ActionType = {
  addDictionary: 'dictionary.add',
  updateDictionary: 'dictionary.update',
  removeDictionary: 'dictionary.remove',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

/** The three dictionaries a document holds, each a sheet of rows. */
export const DictionaryKind = {
  word: 'word',
  term: 'term',
  domain: 'domain',
} as const;
export type DictionaryKind = ValuesType<typeof DictionaryKind>;

export const DictionaryKindList: ReadonlyArray<DictionaryKind> =
  Object.values(DictionaryKind);

/** What a row of each dictionary holds besides its id and its place in its sheet. */
export type DictionaryValues = {
  [DictionaryKind.word]: Omit<Word, 'id' | 'order'>;
  [DictionaryKind.term]: Omit<Term, 'id' | 'order'>;
  [DictionaryKind.domain]: Omit<Domain, 'id' | 'order'>;
};

/** What an action writes into a row: its values and its order key, which places it in its sheet. */
export type DictionaryStoredValues = {
  [K in DictionaryKind]: DictionaryValues[K] & { order: string };
};

/**
 * The fields of each dictionary's rows, in the order a reducer writes them.
 * Every field is a string, and each is a register of its own.
 */
export const DictionaryFields = {
  [DictionaryKind.word]: [
    'name',
    'abbreviation',
    'englishName',
    'description',
    'synonyms',
    'forbiddenWords',
  ],
  [DictionaryKind.term]: [
    'name',
    'physicalName',
    'domainId',
    'description',
    'synonyms',
  ],
  [DictionaryKind.domain]: ['name', 'category', 'dataType', 'description'],
} as const satisfies {
  [K in DictionaryKind]: ReadonlyArray<keyof DictionaryValues[K]>;
};

/**
 * The fields a reducer writes, a register each: the values and the order key,
 * which no sheet column, file column or tool shows.
 */
export const DictionaryStoredFields = {
  [DictionaryKind.word]: [...DictionaryFields.word, 'order'],
  [DictionaryKind.term]: [...DictionaryFields.term, 'order'],
  [DictionaryKind.domain]: [...DictionaryFields.domain, 'order'],
} as const satisfies {
  [K in DictionaryKind]: ReadonlyArray<keyof DictionaryStoredValues[K]>;
};

/** One row of one dictionary, and the values an action writes into it. */
export type DictionaryRowPayload = {
  [K in DictionaryKind]: {
    kind: K;
    id: string;
    values: Partial<DictionaryStoredValues[K]>;
  };
}[DictionaryKind];

/** A row to list, with the values it starts with, none for a row brought back. */
export type DictionaryAddPayload = {
  [K in DictionaryKind]: {
    kind: K;
    id: string;
    values?: Partial<DictionaryStoredValues[K]>;
  };
}[DictionaryKind];

export type ActionMap = {
  [ActionType.addDictionary]: DictionaryAddPayload;
  [ActionType.updateDictionary]: DictionaryRowPayload;
  [ActionType.removeDictionary]: {
    kind: DictionaryKind;
    id: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
