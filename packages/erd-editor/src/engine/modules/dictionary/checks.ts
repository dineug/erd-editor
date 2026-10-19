import { query } from '@dineug/erd-editor-schema';

import type { RootState } from '@/engine/state';
import type { Column, Table, ValuesType } from '@/internal-types';

import { DictionaryKind, DictionaryKindList } from './actions';
import { decompose, derivePhysical, WordTokenKind } from './derive';
import {
  DictionaryRowOf,
  getDomainNames,
  getTermNames,
  getWordIndex,
  NameIndex,
  normalizeDictionaryName,
} from './dictionaryIndex';
import { isListed } from './membership';

/** The six checks the dictionaries run over the tables, columns and rows. */
export const DictionaryCheckCode = {
  duplicateName: 'duplicateName',
  unknownDomain: 'unknownDomain',
  unregisteredWord: 'unregisteredWord',
  forbiddenWord: 'forbiddenWord',
  synonymWord: 'synonymWord',
  physicalNameMismatch: 'physicalNameMismatch',
} as const;
export type DictionaryCheckCode = ValuesType<typeof DictionaryCheckCode>;

export const DictionaryCheckCodeList: ReadonlyArray<DictionaryCheckCode> =
  Object.values(DictionaryCheckCode);

/** How loud a check shows: an error or a warning. */
export const DictionaryCheckLevel = {
  error: 'error',
  warning: 'warning',
} as const;
export type DictionaryCheckLevel = ValuesType<typeof DictionaryCheckLevel>;

/**
 * A name two rows share, a link to no listed domain and a forbidden word are
 * errors; an unregistered word, a synonym and a physical name the term would
 * not give are warnings.
 */
export const DictionaryCheckLevelOf: Readonly<
  Record<DictionaryCheckCode, DictionaryCheckLevel>
> = {
  duplicateName: DictionaryCheckLevel.error,
  unknownDomain: DictionaryCheckLevel.error,
  unregisteredWord: DictionaryCheckLevel.warning,
  forbiddenWord: DictionaryCheckLevel.error,
  synonymWord: DictionaryCheckLevel.warning,
  physicalNameMismatch: DictionaryCheckLevel.warning,
};

/** What a check is about: a table, a column or a dictionary row. */
export type DictionaryCheckTargetKind = 'table' | 'column' | DictionaryKind;

/** The cell a check marks, by the field it reads. */
export type DictionaryCheckField = 'name' | 'logicalName' | 'domainId';

/**
 * One finding. The target's table id is set for a table or a column and ''
 * for a dictionary row. The text is what the check found, and suggestions are
 * the standard words or the physical name the dictionaries offer instead.
 */
export type DictionaryCheck = {
  code: DictionaryCheckCode;
  target: {
    kind: DictionaryCheckTargetKind;
    id: string;
    tableId: string;
  };
  field: DictionaryCheckField;
  text: string;
  suggestions: string[];
};

type Target = DictionaryCheck['target'];
type Push = (check: Omit<DictionaryCheck, 'target'>) => void;

const TOKEN_CODE = {
  [WordTokenKind.synonym]: DictionaryCheckCode.synonymWord,
  [WordTokenKind.forbidden]: DictionaryCheckCode.forbiddenWord,
  [WordTokenKind.unregistered]: DictionaryCheckCode.unregisteredWord,
} as const;

const uniqueNames = (rows: ReadonlyArray<{ name: string }>): string[] => [
  ...new Set(rows.map(({ name }) => normalizeDictionaryName(name))),
];

/** The words a name uses that the word sheet lists as no standard word; silent with no word. */
function wordChecks(
  state: RootState,
  field: DictionaryCheckField,
  name: string,
  push: Push
) {
  const index = getWordIndex(state);
  if (index.byName.size === 0) return;

  const seen = new Set<string>();
  for (const token of decompose(index, name)) {
    if (token.kind === WordTokenKind.word) continue;

    const code = TOKEN_CODE[token.kind];
    const key = `${code}:${token.text}`;
    if (seen.has(key)) continue;

    seen.add(key);
    push({
      code,
      field,
      text: token.text,
      suggestions: uniqueNames(token.words),
    });
  }
}

/** A physical name other than the one the matched term gives; silent with no term. */
function mismatchCheck(
  state: RootState,
  logicalName: string,
  physicalName: string,
  push: Push
) {
  const derived = derivePhysical(state, logicalName);
  if (!derived?.term || !derived.physicalName) return;
  if (physicalName.trim() === derived.physicalName) return;

  push({
    code: DictionaryCheckCode.physicalNameMismatch,
    field: 'name',
    text: physicalName,
    suggestions: [derived.physicalName],
  });
}

/** A link to a domain the document does not list; silent with no domain listed. */
function domainCheck(state: RootState, domainId: string, push: Push) {
  const { domainIds } = state.doc;
  if (!domainId || domainIds.length === 0 || isListed(domainIds, domainId)) {
    return;
  }

  push({
    code: DictionaryCheckCode.unknownDomain,
    field: 'domainId',
    text: state.collections.domainEntities[domainId]?.name || domainId,
    suggestions: [],
  });
}

type NamedRow = { id: string; name: string };

const NAME_INDEX: Record<
  DictionaryKind,
  (state: RootState) => NameIndex<NamedRow>
> = {
  [DictionaryKind.word]: getWordIndex,
  [DictionaryKind.term]: getTermNames,
  [DictionaryKind.domain]: getDomainNames,
};

/** A name another listed row of the same sheet holds; a row without a name has none. */
function duplicateCheck(index: NameIndex<NamedRow>, row: NamedRow, push: Push) {
  const name = normalizeDictionaryName(row.name);
  const named = name ? index.byName.get(name) : undefined;
  if (!named || named.length < 2 || !named.some(({ id }) => id === row.id)) {
    return;
  }

  push({
    code: DictionaryCheckCode.duplicateName,
    field: 'name',
    text: name,
    suggestions: [],
  });
}

function collect(
  target: Target,
  field: DictionaryCheckField | undefined,
  run: (wants: (field: DictionaryCheckField) => boolean, push: Push) => void
): DictionaryCheck[] {
  const checks: DictionaryCheck[] = [];
  run(
    wanted => !field || wanted === field,
    check => checks.push({ ...check, target })
  );
  return checks;
}

/**
 * The checks of a table, or of one of its cells when a field is given: the
 * words of its logical name and the physical name its term gives. Each reads
 * an index, so marking a cell walks no sheet.
 */
export const checkTable = (
  state: RootState,
  table: Table,
  field?: DictionaryCheckField
): DictionaryCheck[] =>
  collect(
    { kind: 'table', id: table.id, tableId: table.id },
    field,
    (wants, push) => {
      wants('logicalName') &&
        wordChecks(state, 'logicalName', table.logicalName, push);
      wants('name') &&
        mismatchCheck(state, table.logicalName, table.name, push);
    }
  );

/** The checks of a column, or of one of its cells: a table's two and its domain link. */
export const checkColumn = (
  state: RootState,
  column: Column,
  field?: DictionaryCheckField
): DictionaryCheck[] =>
  collect(
    { kind: 'column', id: column.id, tableId: column.tableId },
    field,
    (wants, push) => {
      wants('logicalName') &&
        wordChecks(state, 'logicalName', column.logicalName, push);
      wants('name') &&
        mismatchCheck(state, column.logicalName, column.name, push);
      wants('domainId') && domainCheck(state, column.domainId, push);
    }
  );

/**
 * The checks of a dictionary row, or of one of its cells: a name another row
 * of its sheet holds, and for a term the words of its name and its domain.
 */
export function checkDictionaryRow<K extends DictionaryKind>(
  state: RootState,
  kind: K,
  row: DictionaryRowOf[K],
  field?: DictionaryCheckField
): DictionaryCheck[] {
  return collect({ kind, id: row.id, tableId: '' }, field, (wants, push) => {
    wants('name') && duplicateCheck(NAME_INDEX[kind](state), row, push);

    if (kind !== DictionaryKind.term) return;
    const term = row as DictionaryRowOf['term'];
    wants('name') && wordChecks(state, 'name', term.name, push);
    wants('domainId') && domainCheck(state, term.domainId, push);
  });
}

/** The loudest level among the checks, null for none: what one cell shows. */
export function markOf(
  checks: ReadonlyArray<DictionaryCheck>
): DictionaryCheckLevel | null {
  let mark: DictionaryCheckLevel | null = null;
  for (const { code } of checks) {
    mark = DictionaryCheckLevelOf[code];
    if (mark === DictionaryCheckLevel.error) break;
  }
  return mark;
}

/**
 * Every check of the document, for the sheet that lists them: the words, the
 * terms and the domains in sheet order, then each table and its columns in
 * document order. It walks everything, so only that sheet asks for it.
 */
export function listDictionaryChecks(state: RootState): DictionaryCheck[] {
  const { doc, collections } = state;
  const checks: DictionaryCheck[] = [];

  for (const kind of DictionaryKindList) {
    for (const row of NAME_INDEX[kind](state).rows) {
      checks.push(
        ...checkDictionaryRow(
          state,
          kind,
          row as DictionaryRowOf[DictionaryKind]
        )
      );
    }
  }

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const columns = query(collections).collection('tableColumnEntities');

  for (const table of tables) {
    checks.push(...checkTable(state, table));
    for (const column of columns.selectByIds(table.columnIds)) {
      checks.push(...checkColumn(state, column));
    }
  }

  return checks;
}
