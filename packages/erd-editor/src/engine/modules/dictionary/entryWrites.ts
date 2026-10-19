import type { AnyAction } from '@dineug/r-html';
import { uuid25 } from '@dineug/uuid';
import { isString } from 'es-toolkit';

import type { RootState } from '@/engine/state';
import type { Domain, Term, ValuesType, Word } from '@/internal-types';
import type { DictionaryCsvRow } from '@/utils/dictionary-csv/dictionaryCsv';

import {
  DictionaryAddPayload,
  DictionaryKind,
  DictionaryRowPayload,
  DictionaryValues,
} from './actions';
import {
  addDictionaryAction,
  dictionaryEntries,
  dictionaryIds,
  selectDictionaryRow,
  updateDictionaryAction,
} from './atom.actions';
import { composeName } from './derive';
import {
  findDomain,
  getDomainNames,
  getTermNames,
  getWordIndex,
  NameIndex,
  normalizeDictionaryName,
} from './dictionaryIndex';
import { toDomainTypeActions } from './domainTypes';
import { isListed } from './membership';

type DictionaryRow = Word | Term | Domain;

/** A row a write names: a listed row by its id, or a new one with none. */
export type DictionaryEntryChange<K extends DictionaryKind = DictionaryKind> = {
  id?: string;
  values: Partial<DictionaryValues[K]>;
};

/** Why a write of a dictionary row is turned away. */
export const DictionaryRefusalCode = {
  duplicateName: 'duplicateName',
  unknownDomain: 'unknownDomain',
} as const;
export type DictionaryRefusalCode = ValuesType<typeof DictionaryRefusalCode>;

/**
 * A row turned away: its position among the changes given, the name it would
 * hold, and the text refused, the normalized name or the domain's id.
 */
export type DictionaryRefusal = {
  code: DictionaryRefusalCode;
  index: number;
  name: string;
  value: string;
};

/** A change resolved against the sheet: the row it updates, null for a new one. */
type EntryRow = {
  index: number;
  existing: DictionaryRow | null;
  values: Record<string, string>;
};

/** The names a commit writes, so two of its rows and a listed row are compared. */
type CommitNames = {
  /** The listed rows whose name the commit writes, which keep their old one no more. */
  renamed: ReadonlySet<string>;
  /** How many rows of the commit write each normalized name. */
  counts: ReadonlyMap<string, number>;
};

/** What one row writes: the add or update, its refusals and a domain's new type. */
type EntryWrites = {
  action: AnyAction | null;
  refusals: DictionaryRefusal[];
  domainType: { id: string; dataType: string } | null;
};

const NAMES: {
  [K in DictionaryKind]: (state: RootState) => NameIndex<DictionaryRow>;
} = {
  [DictionaryKind.word]: getWordIndex,
  [DictionaryKind.term]: getTermNames,
  [DictionaryKind.domain]: getDomainNames,
};

const valuesOf = (
  kind: DictionaryKind,
  values: unknown
): Record<string, string> =>
  Object.fromEntries(dictionaryEntries(kind, values));

const isNameWritten = ({ existing, values }: EntryRow) =>
  isString(values.name) && (!existing || existing.name !== values.name);

const nameOf = ({ existing, values }: EntryRow) =>
  normalizeDictionaryName(values.name ?? existing?.name ?? '');

/** Reads the changes against the sheet, passing over one naming a row it no longer lists. */
function resolveChanges(
  state: RootState,
  kind: DictionaryKind,
  changes: ReadonlyArray<DictionaryEntryChange>
): EntryRow[] {
  const ids = dictionaryIds(state, kind);
  const rows: EntryRow[] = [];

  changes.forEach(({ id, values }, index) => {
    if (id === undefined) {
      rows.push({ index, existing: null, values: valuesOf(kind, values) });
      return;
    }
    if (!isListed(ids, id)) return;

    const existing = selectDictionaryRow(state, kind, id);
    if (existing) {
      rows.push({ index, existing, values: valuesOf(kind, values) });
    }
  });

  return rows;
}

function commitNamesOf(rows: ReadonlyArray<EntryRow>): CommitNames {
  const renamed = new Set<string>();
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!isNameWritten(row)) continue;
    if (row.existing) renamed.add(row.existing.id);

    const name = nameOf(row);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return { renamed, counts };
}

function refusalsOf(
  state: RootState,
  kind: DictionaryKind,
  row: EntryRow,
  names: CommitNames
): DictionaryRefusal[] {
  const refusals: DictionaryRefusal[] = [];
  const name = nameOf(row);
  const refuse = (code: DictionaryRefusalCode, value: string) =>
    refusals.push({ code, index: row.index, name, value });

  if (name && isNameWritten(row)) {
    const listed = (NAMES[kind](state).byName.get(name) ?? []).filter(
      ({ id }) => id !== row.existing?.id && !names.renamed.has(id)
    );
    if (listed.length || (names.counts.get(name) ?? 0) > 1) {
      refuse(DictionaryRefusalCode.duplicateName, name);
    }
  }

  const domainId = row.values.domainId;
  if (
    kind === DictionaryKind.term &&
    domainId &&
    domainId !== Reflect.get(row.existing ?? {}, 'domainId') &&
    !isListed(state.doc.domainIds, domainId)
  ) {
    refuse(DictionaryRefusalCode.unknownDomain, domainId);
  }

  return refusals;
}

/**
 * The write of one row: its add, or an update of the fields that change, and
 * a domain's new data type. A term given a name and holding no physical name
 * gets the one its words compose. With the commit's names it also refuses.
 */
function toEntryWrites(
  state: RootState,
  kind: DictionaryKind,
  row: EntryRow,
  names?: CommitNames
): EntryWrites {
  const values = { ...row.values };
  const { existing } = row;

  if (kind === DictionaryKind.term && isString(values.name)) {
    const physicalName: string =
      values.physicalName ?? Reflect.get(existing ?? {}, 'physicalName') ?? '';
    const composed = physicalName.trim()
      ? null
      : composeName(state, values.name);
    if (composed) values.physicalName = composed;
  }

  const refusals = names
    ? refusalsOf(state, kind, { ...row, values }, names)
    : [];
  const changed = Object.fromEntries(
    Object.entries(values).filter(([field, value]) =>
      existing ? Reflect.get(existing, field) !== value : value !== ''
    )
  );
  const hasChanges = Object.keys(changed).length > 0;

  if (!existing) {
    return {
      action: addDictionaryAction({
        kind,
        id: uuid25(),
        ...(hasChanges ? { values: changed } : {}),
      } as DictionaryAddPayload),
      refusals,
      domainType: null,
    };
  }

  return {
    action: hasChanges
      ? updateDictionaryAction({
          kind,
          id: existing.id,
          values: changed,
        } as DictionaryRowPayload)
      : null,
    refusals,
    domainType:
      kind === DictionaryKind.domain && isString(changed.dataType)
        ? { id: existing.id, dataType: changed.dataType }
        : null,
  };
}

/** The row actions of every write and the column actions their domains' types call for. */
function toWriteActions(
  state: RootState,
  writes: ReadonlyArray<EntryWrites>
): AnyAction[] {
  const domainTypes = new Map<string, string>();
  const actions: AnyAction[] = [];

  for (const { action, domainType } of writes) {
    if (action) actions.push(action);
    if (domainType) domainTypes.set(domainType.id, domainType.dataType);
  }

  if (domainTypes.size) {
    actions.push(...toDomainTypeActions(state, { domainTypes }));
  }
  return actions;
}

/**
 * Why each change would be turned away: a name another listed row of the
 * sheet or another row of the same changes holds, compared normalized, or a
 * term's domain the document does not list. An empty name is never refused.
 */
export function validateDictionaryValues<K extends DictionaryKind>(
  state: RootState,
  kind: K,
  changes: ReadonlyArray<DictionaryEntryChange<K>>
): DictionaryRefusal[] {
  const rows = resolveChanges(state, kind, changes);
  const names = commitNamesOf(rows);
  return rows.flatMap(row => refusalsOf(state, kind, row, names));
}

/** What a commit sends: nothing while any row of it is refused. */
export type DictionaryCommit = {
  actions: AnyAction[];
  refusals: DictionaryRefusal[];
};

/**
 * The actions of a commit of rows, updates of listed rows and adds of new
 * ones, with the columns its domains' new types reach, or none at all when a
 * row is refused, so one commit lands whole or not.
 */
export function toDictionaryCommit<K extends DictionaryKind>(
  state: RootState,
  kind: K,
  changes: ReadonlyArray<DictionaryEntryChange<K>>
): DictionaryCommit {
  const rows = resolveChanges(state, kind, changes);
  const names = commitNamesOf(rows);
  const writes = rows.map(row => toEntryWrites(state, kind, row, names));
  const refusals = writes.flatMap(({ refusals }) => refusals);

  return {
    actions: refusals.length ? [] : toWriteActions(state, writes),
    refusals,
  };
}

/** What an import of a file's rows sends, and the counts its message shows. */
export type DictionaryImport = {
  actions: AnyAction[];
  added: number;
  updated: number;
  /** The rows a later row of the same name replaced, or with no name. */
  folded: number;
  /** Each domain name a term row gives that the document lists no domain of. */
  unknownDomains: string[];
};

/**
 * Folds a file's rows by normalized name, the later row's values in the
 * earlier one's place, then updates the listed row of each name and adds the
 * rest. A term's domain is read by name, '' where no domain has it.
 */
export function toDictionaryImport<K extends DictionaryKind>(
  state: RootState,
  kind: K,
  rows: ReadonlyArray<DictionaryCsvRow<K>>
): DictionaryImport {
  const folded = new Map<string, DictionaryCsvRow<K>>();
  for (const row of rows) {
    const name = normalizeDictionaryName(row.name);
    if (name) folded.set(name, row);
  }

  const names = NAMES[kind](state);
  const unknownDomains = new Map<string, string>();
  const writes: EntryWrites[] = [];
  let added = 0;
  let updated = 0;

  for (const [name, row] of folded) {
    const values = valuesOf(kind, row);
    const domain: unknown = Reflect.get(row, 'domain');

    if (kind === DictionaryKind.term && isString(domain)) {
      const key = normalizeDictionaryName(domain);
      const found = key ? findDomain(state, key) : undefined;
      values.domainId = found?.id ?? '';
      if (key && !found && !unknownDomains.has(key)) {
        unknownDomains.set(key, domain.trim());
      }
    }

    const existing = names.byName.get(name)?.[0] ?? null;
    const write = toEntryWrites(state, kind, { index: 0, existing, values });
    if (write.action) {
      writes.push(write);
      if (existing) updated++;
      else added++;
    }
  }

  return {
    actions: toWriteActions(state, writes),
    added,
    updated,
    folded: rows.length - folded.size,
    unknownDomains: [...unknownDomains.values()],
  };
}
