import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { isString } from 'es-toolkit';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Domain, Term, Word } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { createDomain } from '@/utils/collection/domain.entity';
import { createTerm } from '@/utils/collection/term.entity';
import { createWord } from '@/utils/collection/word.entity';
import { textInRange } from '@/utils/validation';

import {
  ActionMap,
  ActionType,
  DictionaryKind,
  DictionaryKindList,
  DictionaryStoredFields,
  ReducerType,
} from './actions';
import { raiseDictionaryGeneration } from './dictionaryIndex';
import { getLiveDomainName, listId, unlistId } from './membership';

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

const CREATE = {
  [DictionaryKind.word]: createWord,
  [DictionaryKind.term]: createTerm,
  [DictionaryKind.domain]: createDomain,
};

/** A kind this release knows; a later release's kind changes nothing here. */
export const hasDictionaryKind = arrayHas<unknown>(DictionaryKindList) as (
  kind: unknown
) => kind is DictionaryKind;

const dictionaryCollection = (state: RootState, kind: DictionaryKind) =>
  query(state.collections).collection(COLLECTION_KEY[kind]);

/** The row of a dictionary the id names, a removed one too. */
export const selectDictionaryRow = (
  state: RootState,
  kind: DictionaryKind,
  id: string
): Word | Term | Domain | undefined =>
  dictionaryCollection(state, kind).selectById(id);

/**
 * The ids of a dictionary's listed rows, in the order they were listed, which
 * membership reads; a sheet shows them in key order (orderedDictionaryRows).
 */
export const dictionaryIds = (
  state: RootState,
  kind: DictionaryKind
): string[] => state.doc[IDS_KEY[kind]];

/**
 * The string values a payload names among the kind's fields, in their order,
 * so a field or a value no editor sends is passed over.
 */
export function dictionaryEntries(
  kind: DictionaryKind,
  values: unknown
): Array<[field: string, value: string]> {
  if (!values || typeof values !== 'object') return [];

  const entries: Array<[string, string]> = [];
  for (const field of DictionaryStoredFields[kind]) {
    const value = Reflect.get(values, field);
    if (isString(value)) entries.push([field, value]);
  }
  return entries;
}

/**
 * Writes each value through the register of its field at the version given,
 * and answers whether a domain's name was written, which a column shows.
 */
function writeDictionaryValues(
  state: RootState,
  kind: DictionaryKind,
  id: string,
  values: unknown,
  version: number
): boolean {
  const collection = dictionaryCollection(state, kind);
  let renamed = false;

  for (const [field, value] of dictionaryEntries(kind, values)) {
    collection.replaceOperator(state.lww, version, id, field, () => {
      collection.updateOne(id, entity => {
        Reflect.set(entity, field, value);
      });
      if (field === 'name') renamed = true;
    });
  }

  return renamed && kind === DictionaryKind.domain;
}

/**
 * Measures the domain cell of every column linking the domain, a removed
 * column's too, so each width reads the domain as it now stands whatever
 * order a peer heard the domain's and the column's changes in.
 */
export function measureDomainColumns(
  state: RootState,
  domainId: string,
  { toWidth }: EngineContext
) {
  const width = textInRange(toWidth(getLiveDomainName(state, domainId)));

  for (const column of Object.values(state.collections.tableColumnEntities)) {
    if (column.domainId === domainId) {
      column.ui.widthDomain = width;
    }
  }
}

export const addDictionaryAction = createAction<
  ActionMap[typeof ActionType.addDictionary]
>(ActionType.addDictionary);

/**
 * Lists a row and writes the values it carries, each through its own register
 * at the add's version, never as a whole entity: a stub a peer's edit made
 * first would turn a whole entity away and lose its values.
 */
const addDictionary: ReducerType<typeof ActionType.addDictionary> = (
  state,
  { payload: { kind, id, values }, version },
  ctx
) => {
  if (!hasDictionaryKind(kind)) return;

  raiseDictionaryGeneration(state, kind);
  const safeVersion = version ?? ctx.clock.getVersion();
  const collection = dictionaryCollection(state, kind);
  collection.getOrCreate(id, id => CREATE[kind]({ id }));

  let listed = false;
  collection.addOperator(state.lww, safeVersion, id, () => {
    listed = listId(dictionaryIds(state, kind), id);
  });

  const renamed = writeDictionaryValues(state, kind, id, values, safeVersion);

  if (kind === DictionaryKind.domain && (listed || renamed)) {
    measureDomainColumns(state, id, ctx);
  }
};

export const updateDictionaryAction = createAction<
  ActionMap[typeof ActionType.updateDictionary]
>(ActionType.updateDictionary);

const updateDictionary: ReducerType<typeof ActionType.updateDictionary> = (
  state,
  { payload: { kind, id, values }, version },
  ctx
) => {
  if (!hasDictionaryKind(kind)) return;

  raiseDictionaryGeneration(state, kind);
  const safeVersion = version ?? ctx.clock.getVersion();
  dictionaryCollection(state, kind).getOrCreate(id, id => CREATE[kind]({ id }));

  if (writeDictionaryValues(state, kind, id, values, safeVersion)) {
    measureDomainColumns(state, id, ctx);
  }
};

export const removeDictionaryAction = createAction<
  ActionMap[typeof ActionType.removeDictionary]
>(ActionType.removeDictionary);

/**
 * Unlists a row and keeps its values, which an undo lists again. A column
 * keeps the id of a domain removed, and its data type, and shows no domain.
 */
const removeDictionary: ReducerType<typeof ActionType.removeDictionary> = (
  state,
  { payload: { kind, id }, version },
  ctx
) => {
  if (!hasDictionaryKind(kind)) return;

  raiseDictionaryGeneration(state, kind);
  const safeVersion = version ?? ctx.clock.getVersion();
  let unlisted = false;
  dictionaryCollection(state, kind).removeOperator(
    state.lww,
    safeVersion,
    id,
    () => {
      unlisted = unlistId(dictionaryIds(state, kind), id);
    }
  );

  if (kind === DictionaryKind.domain && unlisted) {
    measureDomainColumns(state, id, ctx);
  }
};

export const dictionaryReducers = {
  [ActionType.addDictionary]: addDictionary,
  [ActionType.updateDictionary]: updateDictionary,
  [ActionType.removeDictionary]: removeDictionary,
};

export const actions = {
  addDictionaryAction,
  updateDictionaryAction,
  removeDictionaryAction,
};
