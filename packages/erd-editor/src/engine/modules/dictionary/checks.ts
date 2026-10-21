import { query } from '@dineug/erd-editor-schema';

import type { RootState } from '@/engine/state';
import type { Column, Domain, Table, Term, ValuesType } from '@/internal-types';

import { DictionaryKind } from './actions';
import { compose, decompose, WordTokenKind } from './derive';
import {
  DictionaryRowOf,
  getDomainNames,
  getTermNames,
  getWordIndex,
  NameIndex,
  normalizeDictionaryName,
  WordIndex,
} from './dictionaryIndex';
import { isListed } from './membership';

/** The seven checks the dictionaries run over the tables, columns and rows. */
export const DictionaryCheckCode = {
  duplicateName: 'duplicateName',
  unknownDomain: 'unknownDomain',
  unregisteredWord: 'unregisteredWord',
  forbiddenWord: 'forbiddenWord',
  synonymWord: 'synonymWord',
  physicalNameMismatch: 'physicalNameMismatch',
  domainTypeMismatch: 'domainTypeMismatch',
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
 * errors; an unregistered word, a synonym, a physical name the term would not
 * give and a type other than the linked domain's are warnings.
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
  domainTypeMismatch: DictionaryCheckLevel.warning,
};

/** What a check is about: a table, a column or a dictionary row. */
export type DictionaryCheckTargetKind = 'table' | 'column' | DictionaryKind;

/** The cell a check marks, by the field it reads. */
export type DictionaryCheckField = 'name' | 'logicalName' | 'domainId';

/**
 * One finding, read only since the walks hand the same one out again. The
 * target's table id is '' for a dictionary row; suggestions are the standard
 * words, the physical name or the type the dictionaries offer instead of the text.
 */
export type DictionaryCheck = Readonly<{
  code: DictionaryCheckCode;
  target: Readonly<{
    kind: DictionaryCheckTargetKind;
    id: string;
    tableId: string;
  }>;
  field: DictionaryCheckField;
  text: string;
  suggestions: ReadonlyArray<string>;
}>;

type Target = DictionaryCheck['target'];
type Found = Omit<DictionaryCheck, 'target'>;
type Push = (check: Found) => void;

const TOKEN_CODE = {
  [WordTokenKind.synonym]: DictionaryCheckCode.synonymWord,
  [WordTokenKind.forbidden]: DictionaryCheckCode.forbiddenWord,
  [WordTokenKind.unregistered]: DictionaryCheckCode.unregisteredWord,
} as const;

const uniqueNames = (rows: ReadonlyArray<{ name: string }>): string[] => [
  ...new Set(rows.map(({ name }) => normalizeDictionaryName(name))),
];

/** A word check before the cell it marks is known, the same for every target whose text it read. */
type WordFinding = Omit<Found, 'field'>;

const NONE: ReadonlyArray<never> = Object.freeze([]);

/** The words a name uses that the word sheet lists as no standard word; none with no word. */
function wordFindings(
  index: WordIndex,
  name: string
): ReadonlyArray<WordFinding> {
  if (index.byName.size === 0) return NONE;

  const findings: WordFinding[] = [];
  const seen = new Set<string>();
  for (const token of decompose(index, name)) {
    if (token.kind === WordTokenKind.word) continue;

    const code = TOKEN_CODE[token.kind];
    const key = `${code}:${token.text}`;
    if (seen.has(key)) continue;

    seen.add(key);
    findings.push({
      code,
      text: token.text,
      suggestions: uniqueNames(token.words),
    });
  }
  return findings.length ? findings : NONE;
}

function pushFindings(
  findings: ReadonlyArray<WordFinding>,
  field: DictionaryCheckField,
  push: Push
) {
  for (const { code, text, suggestions } of findings) {
    push({ code, field, text, suggestions });
  }
}

const wordChecks = (
  state: RootState,
  field: DictionaryCheckField,
  name: string,
  push: Push
) => pushFindings(wordFindings(getWordIndex(state), name), field, push);

/**
 * A physical name other than the one the matched term gives, read from the
 * indexes handed, which a walk takes as it begins; silent with no term.
 */
function mismatchCheck(
  terms: NameIndex<Term>,
  words: WordIndex,
  logicalName: string,
  physicalName: string,
  push: Push
) {
  const name = normalizeDictionaryName(logicalName);
  const term = name ? terms.byName.get(name)?.[0] : undefined;
  if (!term) return;

  // What derivePhysical gives on these indexes: the term's own, else the words composed.
  const derived =
    term.physicalName.trim() ||
    (words.byName.size === 0 ? '' : (compose(decompose(words, name)) ?? ''));
  if (!derived || physicalName.trim() === derived) return;

  push({
    code: DictionaryCheckCode.physicalNameMismatch,
    field: 'name',
    text: physicalName,
    suggestions: [derived],
  });
}

/** The text a link to a domain the document does not list shows, null for none; silent with no domain listed. */
function unknownDomainText(
  state: RootState,
  domainId: string,
  domainIds = state.doc.domainIds
): string | null {
  if (!domainId || domainIds.length === 0 || isListed(domainIds, domainId)) {
    return null;
  }
  return state.collections.domainEntities[domainId]?.name || domainId;
}

function domainCheck(
  state: RootState,
  domainId: string,
  push: Push,
  domainIds = state.doc.domainIds
) {
  const text = unknownDomainText(state, domainId, domainIds);
  if (text === null) return;

  push({
    code: DictionaryCheckCode.unknownDomain,
    field: 'domainId',
    text,
    suggestions: [],
  });
}

/** The type of the listed domain a link names, null for no link or a domain not listed. */
function linkedDomainType(
  state: RootState,
  domainId: string,
  domainIds = state.doc.domainIds
): string | null {
  if (!domainId || !isListed(domainIds, domainId)) return null;
  return state.collections.domainEntities[domainId]?.dataType ?? null;
}

/** A column's type other than the one the listed domain it links gives, which a peer's link beside a type change can leave. */
function domainTypeCheck(
  state: RootState,
  { domainId, dataType }: Column,
  push: Push,
  domainIds = state.doc.domainIds
) {
  const domainType = linkedDomainType(state, domainId, domainIds);
  if (domainType === null || domainType === dataType) return;

  push({
    code: DictionaryCheckCode.domainTypeMismatch,
    field: 'domainId',
    text: dataType,
    suggestions: [domainType],
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

/** Whether another listed row of the sheet holds the normalized name; an empty name has none. */
function sharesName(index: NameIndex<NamedRow>, name: string, id: string) {
  const named = name ? index.byName.get(name) : undefined;
  return !!named && named.length > 1 && named.some(row => row.id === id);
}

function duplicateCheck(index: NameIndex<NamedRow>, row: NamedRow, push: Push) {
  const name = normalizeDictionaryName(row.name);
  if (!sharesName(index, name, row.id)) return;

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
        mismatchCheck(
          getTermNames(state),
          getWordIndex(state),
          table.logicalName,
          table.name,
          push
        );
    }
  );

/** The checks of a column, or of one of its cells: a table's two, its domain link and its type against that domain's. */
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
        mismatchCheck(
          getTermNames(state),
          getWordIndex(state),
          column.logicalName,
          column.name,
          push
        );
      if (!wants('domainId')) return;
      domainCheck(state, column.domainId, push);
      domainTypeCheck(state, column, push);
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

/** What the words read in a text, a term's name or a logical name: held while the text and the word index are the same. */
type Reading = {
  words: WordIndex;
  text: string;
  /** The text as every lookup compares it. */
  name: string;
  findings: ReadonlyArray<WordFinding>;
};

/** What a walk last found for one target, and the values its checks read to find it. */
type Held = {
  walk: number;
  reading: Reading;
  inputs: ReadonlyArray<unknown>;
  checks: ReadonlyArray<DictionaryCheck>;
};

/** What the walks hold of one collection's targets, by id, and how many the current walk met. */
type Kept = { held: Map<string, Held>; walk: number; met: number };

const keptOf = new WeakMap<object, Kept>();

/**
 * Starts a walk over a collection's targets. A load brings new collections,
 * so nothing held over the document before is read again.
 */
function beginWalk(collection: object): Kept {
  let kept = keptOf.get(collection);
  if (!kept) {
    kept = { held: new Map(), walk: 0, met: 0 };
    keptOf.set(collection, kept);
  }
  kept.walk++;
  kept.met = 0;
  return kept;
}

/** Forgets the targets a walk run to its end did not meet, unless a later walk began meanwhile. */
function endWalk(kept: Kept, walk: number) {
  if (kept.walk !== walk || kept.held.size === kept.met) return;

  for (const [id, held] of kept.held) {
    if (held.walk !== walk) kept.held.delete(id);
  }
}

const sameInputs = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** The reading a target held while its text and the words stand, else the walk's of the text, read once per walk. */
function readingOf(
  held: Held | undefined,
  readings: Map<string, Reading>,
  words: WordIndex,
  text: string
): Reading {
  const reading = held?.reading;
  if (reading && reading.words === words && reading.text === text) {
    return reading;
  }

  let read = readings.get(text);
  if (!read) {
    read = {
      words,
      text,
      name: normalizeDictionaryName(text),
      findings: wordFindings(words, text),
    };
    readings.set(text, read);
  }
  return read;
}

/**
 * The checks of one target, built again only once its reading or a value
 * they read changes: its own fields and what the indexes answer for them,
 * never the entity object, which the store writes in place.
 */
function heldChecks(
  kept: Kept,
  readings: Map<string, Reading>,
  target: Target,
  words: WordIndex,
  text: string,
  inputsOf: (reading: Reading) => ReadonlyArray<unknown>,
  run: (push: Push, reading: Reading) => void
): ReadonlyArray<DictionaryCheck> {
  let held = kept.held.get(target.id);
  if (held?.walk !== kept.walk) kept.met++;

  const reading = readingOf(held, readings, words, text);
  const inputs = inputsOf(reading);

  if (!held || held.reading !== reading || !sameInputs(held.inputs, inputs)) {
    const checks: DictionaryCheck[] = [];
    run(check => checks.push({ ...check, target }), reading);

    held = {
      walk: kept.walk,
      reading,
      inputs,
      checks: checks.length ? checks : NONE,
    };
    kept.held.set(target.id, held);
  }

  held.walk = kept.walk;
  return held.checks;
}

/** The physical name of the term a name matches, which the mismatch reads, null with no term. */
const termPhysicalName = (terms: NameIndex<Term>, name: string) =>
  terms.byName.get(name)?.[0]?.physicalName ?? null;

const sheetChecksOf = new WeakMap<object, ReadonlyArray<DictionaryCheck>>();

/**
 * The checks of the word or the domain sheet, a name two of its rows share,
 * read on the index handed, which a walk takes as it begins: held per index.
 */
function sheetChecks(
  kind: typeof DictionaryKind.word | typeof DictionaryKind.domain,
  index: NameIndex<NamedRow>
): ReadonlyArray<DictionaryCheck> {
  let checks = sheetChecksOf.get(index);
  if (!checks) {
    checks = index.rows.flatMap(row =>
      collect({ kind, id: row.id, tableId: '' }, undefined, (_, push) =>
        duplicateCheck(index, row, push)
      )
    );
    sheetChecksOf.set(index, checks);
  }
  return checks;
}

type TermSheetChecks = {
  words: WordIndex;
  domains: NameIndex<Domain>;
  checks: ReadonlyArray<DictionaryCheck>;
};

const termSheetChecksOf = new WeakMap<object, TermSheetChecks>();

/** The term sheet's checks one term at a time, or all at once while the three indexes they read stand. */
function* termSheetSteps(
  state: RootState,
  readings: Map<string, Reading>,
  words: WordIndex,
  terms: NameIndex<Term>,
  domains: NameIndex<Domain>
): Generator<ReadonlyArray<DictionaryCheck>, void, undefined> {
  const sheet = termSheetChecksOf.get(terms);
  if (sheet && sheet.words === words && sheet.domains === domains) {
    yield sheet.checks;
    return;
  }

  const kept = beginWalk(state.collections.termEntities);
  const { walk } = kept;
  const { domainIds } = state.doc;
  const checks: DictionaryCheck[] = [];

  for (const term of terms.rows) {
    const { id, name, domainId } = term;
    const found = heldChecks(
      kept,
      readings,
      { kind: DictionaryKind.term, id, tableId: '' },
      words,
      name,
      reading => [
        sharesName(terms, reading.name, id),
        unknownDomainText(state, domainId, domainIds),
      ],
      (push, reading) => {
        duplicateCheck(terms, term, push);
        pushFindings(reading.findings, 'name', push);
        domainCheck(state, domainId, push, domainIds);
      }
    );
    for (const check of found) checks.push(check);
    yield found;
  }

  endWalk(kept, walk);
  termSheetChecksOf.set(terms, { words, domains, checks });
}

/**
 * Every check of the document in the order listDictionaryChecks gives them,
 * a sheet, a term, a table or a column at a time, so a caller can stop
 * between two and go on while the state stays as it was.
 */
export function* walkDictionaryChecks(
  state: RootState
): Generator<ReadonlyArray<DictionaryCheck>, void, undefined> {
  const { doc, collections } = state;
  const words = getWordIndex(state);
  const terms = getTermNames(state);
  const domains = getDomainNames(state);

  // A logical name a term holds reads the same, so the term sheet's readings serve the tables too.
  const readings = new Map<string, Reading>();

  yield sheetChecks(DictionaryKind.word, words);
  yield* termSheetSteps(state, readings, words, terms, domains);
  yield sheetChecks(DictionaryKind.domain, domains);

  const tableKept = beginWalk(collections.tableEntities);
  const tableWalk = tableKept.walk;
  const columnKept = beginWalk(collections.tableColumnEntities);
  const columnWalk = columnKept.walk;
  const { domainIds } = doc;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const columns = query(collections).collection('tableColumnEntities');

  for (const table of tables) {
    const { id, logicalName, name } = table;
    yield heldChecks(
      tableKept,
      readings,
      { kind: 'table', id, tableId: id },
      words,
      logicalName,
      reading => [name, termPhysicalName(terms, reading.name)],
      (push, reading) => {
        pushFindings(reading.findings, 'logicalName', push);
        mismatchCheck(terms, words, logicalName, name, push);
      }
    );

    for (const column of columns.selectByIds(table.columnIds)) {
      const { id, tableId, logicalName, name, domainId, dataType } = column;
      yield heldChecks(
        columnKept,
        readings,
        { kind: 'column', id, tableId },
        words,
        logicalName,
        reading => [
          tableId,
          name,
          termPhysicalName(terms, reading.name),
          unknownDomainText(state, domainId, domainIds),
          dataType,
          linkedDomainType(state, domainId, domainIds),
        ],
        (push, reading) => {
          pushFindings(reading.findings, 'logicalName', push);
          mismatchCheck(terms, words, logicalName, name, push);
          domainCheck(state, domainId, push, domainIds);
          domainTypeCheck(state, column, push, domainIds);
        }
      );
    }
  }

  endWalk(tableKept, tableWalk);
  endWalk(columnKept, columnWalk);
}

/**
 * Every check of the document, for the sheet that lists them: the words, the
 * terms and the domains in sheet order, then each table and its columns in
 * document order, each target checked again only once a value it read moved.
 */
export function listDictionaryChecks(state: RootState): DictionaryCheck[] {
  const checks: DictionaryCheck[] = [];
  for (const step of walkDictionaryChecks(state)) {
    for (const check of step) checks.push(check);
  }
  return checks;
}
