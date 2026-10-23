import {
  type DictionaryCheck,
  type DictionaryCheckCode,
  DictionaryCheckLevel,
  DictionaryCheckLevelOf,
  listDictionaryChecks,
  type RootState,
} from '@dineug/erd-editor/peer.js';

import { MAX_READ_CHARS } from '@/tools/budget';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { DEFAULT_PAGE_SIZE, findTables } from '@/tools/outline';

export const CHECKS_TOOL = 'erd_list_checks';

/** The levels erd_list_checks takes, as the check sheet tells them apart. */
export const CHECK_LEVELS = Object.freeze(Object.values(DictionaryCheckLevel));

export type CheckLevel = (typeof CHECK_LEVELS)[number];

export type CheckListOptions = {
  readonly level?: CheckLevel;
  readonly tableIds?: readonly string[];
  readonly tableNames?: readonly string[];
  readonly offset?: number;
  readonly limit?: number;
};

/**
 * One check as an agent acts on it: the target by id with the names that
 * place it, the field read, the text found and what the dictionaries offer.
 */
export type ListedCheck = {
  level: CheckLevel;
  code: DictionaryCheckCode;
  kind: DictionaryCheck['target']['kind'];
  id: string;
  tableId?: string;
  table?: string;
  name: string;
  logicalName?: string;
  field: DictionaryCheck['field'];
  text: string;
  suggestions?: readonly string[];
};

export type CheckList = {
  total: number;
  counts: Partial<Record<DictionaryCheckCode, number>>;
  nextOffset?: number;
  note?: string;
  checks: ListedCheck[];
};

/** Room kept for the note an answer may carry. */
const NOTE_ROOM = 700;

/** The characters a value takes in an answer, with the comma before it. */
const cost = (value: unknown) => JSON.stringify(value).length + 1;

const DICTIONARY_ROWS = {
  word: 'wordEntities',
  term: 'termEntities',
  domain: 'domainEntities',
} as const;

function toListedCheck(
  state: RootState,
  { code, target, field, text, suggestions }: DictionaryCheck
): ListedCheck {
  const { tableEntities, tableColumnEntities } = state.collections;
  const head = {
    level: DictionaryCheckLevelOf[code],
    code,
    kind: target.kind,
    id: target.id,
  };
  const tail = {
    field,
    text,
    ...(suggestions.length ? { suggestions } : {}),
  };

  if (target.kind === 'table' || target.kind === 'column') {
    const table = tableEntities[target.tableId];
    const entity =
      target.kind === 'table' ? table : tableColumnEntities[target.id];
    return {
      ...head,
      ...(target.kind === 'column'
        ? { tableId: target.tableId, table: table?.name ?? '' }
        : {}),
      name: entity?.name ?? '',
      ...(entity?.logicalName ? { logicalName: entity.logicalName } : {}),
      ...tail,
    };
  }
  const row = state.collections[DICTIONARY_ROWS[target.kind]][target.id];
  return { ...head, name: row?.name ?? '', ...tail };
}

/** The live tables a filter names, refused by name where one names none. */
function filteredTableIds(
  state: RootState,
  { tableIds, tableNames }: CheckListOptions
): Set<string> | undefined {
  if (tableIds === undefined && tableNames === undefined) return undefined;

  const { ids, missing } = findTables(state, { tableIds, tableNames });
  if (missing.length) {
    throw new ToolError(
      ToolErrorCode.notFound,
      CHECKS_TOOL,
      `${missing.join(', ')} ${missing.length === 1 ? 'names' : 'name'} no live table; erd_list lists them`
    );
  }
  return new Set(ids);
}

const hasDictionaryRows = ({ doc }: RootState) =>
  doc.wordIds.length + doc.termIds.length + doc.domainIds.length > 0;

/**
 * What the dictionaries find, in the check sheet's order, a page at a time as
 * one read holds, with the count of each code over every page the filters keep.
 */
export function toCheckList(
  state: RootState,
  options: CheckListOptions = {}
): CheckList {
  const { level, offset = 0, limit = DEFAULT_PAGE_SIZE } = options;
  const tables = filteredTableIds(state, options);
  const found = listDictionaryChecks(state).filter(
    ({ code, target }) =>
      (level === undefined || DictionaryCheckLevelOf[code] === level) &&
      (tables === undefined || tables.has(target.tableId))
  );

  const counts: CheckList['counts'] = {};
  for (const code of Object.keys(DictionaryCheckLevelOf)) {
    const n = found.filter(check => check.code === code).length;
    if (n) counts[code as DictionaryCheckCode] = n;
  }

  const checks: ListedCheck[] = [];
  let used = cost({ total: found.length, counts }) + NOTE_ROOM;
  let at = offset;
  for (; at < found.length && checks.length < limit; at++) {
    const listed = toListedCheck(state, found[at]);
    const listedCost = cost(listed);
    if (checks.length && used + listedCost > MAX_READ_CHARS) break;
    used += listedCost;
    checks.push(listed);
  }

  const nextOffset = at < found.length ? at : undefined;
  let note: string | undefined;
  if (!hasDictionaryRows(state)) {
    note =
      'The dictionaries hold no word, term or domain, so nothing is checked.';
  } else if (offset >= found.length && offset > 0) {
    note = `offset ${offset} is past the end of the ${found.length} checks the filters keep.`;
  } else if (nextOffset !== undefined) {
    note = `This page lists checks ${offset + 1} to ${at} of ${found.length}; for the next page pass offset ${nextOffset} with the same filters, or offset 0 once you have fixed some, since a fixed check leaves the list.`;
  }

  return {
    total: found.length,
    counts,
    ...(nextOffset === undefined ? {} : { nextOffset }),
    ...(note ? { note } : {}),
    checks,
  };
}
