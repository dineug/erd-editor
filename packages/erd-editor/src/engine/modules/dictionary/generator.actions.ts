import { generateOrderKeys, query } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';

import { GeneratorAction } from '@/engine/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeTableLogicalNameAction } from '@/engine/modules/table/atom.actions';
import type { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { changeColumnLogicalNameAction } from '@/engine/modules/table-column/atom.actions';
import type { RootState } from '@/engine/state';
import type { ValuesType } from '@/internal-types';
import type { DictionaryCsvRow } from '@/utils/dictionary-csv/dictionaryCsv';

import { DictionaryFields, DictionaryKind, DictionaryValues } from './actions';
import {
  dictionaryIds,
  hasDictionaryKind,
  removeDictionaryAction,
} from './atom.actions';
import {
  type ColumnNameLedger,
  toColumnNameWrites,
  toTableNameWrites,
} from './derivedNames';
import { orderedDictionaryRows } from './dictionaryIndex';
import { toDomainTypeActions } from './domainTypes';
import {
  DictionaryEntryChange,
  toDictionaryCommit,
  toDictionaryImport,
} from './entryWrites';
import { getLiveDomainName, isListed } from './membership';
import { placeOrderKeys } from './orderKeys';

const tableOf = (state: RootState, id: string) =>
  query(state.collections).collection('tableEntities').selectById(id);

const columnOf = (state: RootState, id: string) =>
  query(state.collections).collection('tableColumnEntities').selectById(id);

/** The commit's actions, or none while any row of it is refused. */
function* commit<K extends DictionaryKind>(
  state: RootState,
  kind: K,
  changes: ReadonlyArray<DictionaryEntryChange<K>>
) {
  if (!hasDictionaryKind(kind)) return;

  const { actions } = toDictionaryCommit(state, kind, changes);
  if (actions.length) yield actions;
}

/**
 * Adds one row at the end of its sheet with the values given, none for an
 * empty row; nothing when its name is another row's or its domain unknown.
 */
export const addDictionaryEntryAction$ = <K extends DictionaryKind>(
  kind: K,
  values: Partial<DictionaryValues[K]> = {}
): GeneratorAction =>
  function* (state) {
    yield* commit(state, kind, [{ values }]);
  };

/** Where inserted rows go: before or after a listed row, or at the end for none. */
export type DictionaryInsertAnchor = {
  id: string;
  place: 'before' | 'after';
} | null;

/** The index inserted rows go in at among a sheet's rows: beside the anchor, or at the end once it is gone. */
function insertIndexOf(
  rows: ReadonlyArray<{ id: string }>,
  anchor: DictionaryInsertAnchor
): number {
  const index = anchor ? rows.findIndex(({ id }) => id === anchor.id) : -1;
  if (!anchor || index === -1) return rows.length;
  return anchor.place === 'after' ? index + 1 : index;
}

/**
 * Inserts empty rows before or after a row in one dispatch, at the end when it
 * is gone, keying the rows around the place again where no key fits between
 * them. Only the editor sends it, so it stays out of the barrel.
 */
export const insertDictionaryEntriesAction$ = (
  kind: DictionaryKind,
  count: number,
  anchor: DictionaryInsertAnchor = null
): GeneratorAction =>
  function* (state) {
    if (!hasDictionaryKind(kind) || count <= 0) return;

    const rows = orderedDictionaryRows(state, kind);
    const { keys, rekeyed } = placeOrderKeys(
      rows,
      insertIndexOf(rows, anchor),
      count
    );

    yield* commit(state, kind, [
      ...rekeyed.map(({ id, order }) => ({ id, values: { order } })),
      ...keys.map(order => ({ values: { order } })),
    ]);
  };

/** Which way a sort runs. */
export const DictionarySortDirection = {
  ascending: 'ascending',
  descending: 'descending',
} as const;
export type DictionarySortDirection = ValuesType<
  typeof DictionarySortDirection
>;

/**
 * Orders a sheet by one field for everyone in one dispatch, by the text a cell
 * shows in the language given, numbers as numbers, empty cells last, ties as
 * they stood; nothing for a sheet in that order. Only the editor sends it.
 */
export const sortDictionaryAction$ = (
  kind: DictionaryKind,
  field: string,
  direction: DictionarySortDirection,
  locale?: string
): GeneratorAction =>
  function* (state) {
    if (!hasDictionaryKind(kind)) return;
    const fields: ReadonlyArray<string> = DictionaryFields[kind];
    if (!fields.includes(field)) return;

    const collator = new Intl.Collator(locale, { numeric: true });
    const sign = direction === DictionarySortDirection.descending ? -1 : 1;
    const textOf = (row: object): string =>
      kind === DictionaryKind.term && field === 'domainId'
        ? getLiveDomainName(state, Reflect.get(row, 'domainId'))
        : Reflect.get(row, field);

    const rows = orderedDictionaryRows(state, kind).map((row, index) => ({
      row,
      index,
      text: textOf(row),
    }));
    rows.sort((a, b) => {
      const emptyA = a.text === '';
      if (emptyA !== (b.text === '')) return emptyA ? 1 : -1;
      return sign * collator.compare(a.text, b.text) || a.index - b.index;
    });
    if (rows.every(({ index }, at) => index === at)) return;

    const keys = generateOrderKeys(null, null, rows.length);
    yield* commit(
      state,
      kind,
      rows.flatMap(({ row }, at) =>
        row.order === keys[at]
          ? []
          : [{ id: row.id, values: { order: keys[at] } }]
      )
    );
  };

/**
 * Writes the fields of a listed row that change, and the type of every column
 * a domain's new type reaches; nothing when the row is refused or unlisted.
 */
export const updateDictionaryEntryAction$ = <K extends DictionaryKind>(
  kind: K,
  id: string,
  values: Partial<DictionaryValues[K]>
): GeneratorAction =>
  function* (state) {
    yield* commit(state, kind, [{ id, values }]);
  };

/**
 * Removes each listed row named, once, in one dispatch, from the end of the
 * list back, each after every named row behind it: removing a whole sheet or
 * its tail moves no other row, while rows a scattered pick leaves still move.
 */
export const removeDictionaryEntriesAction$ = (
  kind: DictionaryKind,
  ids: ReadonlyArray<string>
): GeneratorAction =>
  function* (state) {
    if (!hasDictionaryKind(kind)) return;

    const listed = dictionaryIds(state, kind);
    const named = new Set(ids.filter(id => isListed(listed, id)));
    if (!named.size) return;

    const removed: string[] = [];
    for (let index = listed.length - 1; index >= 0; index--) {
      if (named.has(listed[index])) removed.push(listed[index]);
    }
    yield removed.map(id => removeDictionaryAction({ kind, id }));
  };

/**
 * A grid's commit: an update of each listed row named and an add of each row
 * past the end, in one dispatch, or nothing at all when any row is refused.
 */
export const commitDictionaryCellsAction$ = <K extends DictionaryKind>(
  kind: K,
  changes: ReadonlyArray<DictionaryEntryChange<K>>
): GeneratorAction =>
  function* (state) {
    yield* commit(state, kind, changes);
  };

/**
 * A file's rows, folded by name and upserted by name in one dispatch: only the
 * adds and the fields that change, so the same file again sends nothing.
 */
export const importDictionaryAction$ = <K extends DictionaryKind>(
  kind: K,
  rows: ReadonlyArray<DictionaryCsvRow<K>>
): GeneratorAction =>
  function* (state) {
    if (!hasDictionaryKind(kind)) return;

    const { actions } = toDictionaryImport(state, kind, rows);
    if (actions.length) yield actions;
  };

/** A column's new logical name, or null to derive from the one it holds. */
type ColumnLogicalName = {
  tableId: string;
  columnId: string;
  logicalName: string | null;
};

/**
 * The column writes of each logical name, then those of every domain they
 * link, read once over all the links, so a key and its foreign key renamed
 * together each settle on their own domain's type.
 */
function columnNameActions(
  state: RootState,
  names: ReadonlyArray<ColumnLogicalName>
): AnyAction[] {
  const actions: AnyAction[] = [];
  const links: ChangeColumnValuePayload[] = [];
  const ledger: ColumnNameLedger = new Map();

  for (const { tableId, columnId, logicalName } of names) {
    const column = columnOf(state, columnId);
    if (!column) continue;

    const value = logicalName ?? column.logicalName;
    if (logicalName !== null && logicalName !== column.logicalName) {
      actions.push(
        changeColumnLogicalNameAction({ tableId, id: columnId, value })
      );
    }
    const writes = toColumnNameWrites(
      state,
      tableId,
      column,
      value,
      false,
      ledger
    );
    actions.push(...writes.actions);
    if (writes.link) links.push(writes.link);
  }

  if (links.length) actions.push(...toDomainTypeActions(state, { links }));
  return actions;
}

function tableNameActions(
  state: RootState,
  tableId: string,
  logicalName: string | null
): AnyAction[] {
  const table = tableOf(state, tableId);
  if (!table) return [];

  const value = logicalName ?? table.logicalName;
  const actions: AnyAction[] =
    logicalName !== null && logicalName !== table.logicalName
      ? [changeTableLogicalNameAction({ id: tableId, value })]
      : [];

  actions.push(...toTableNameWrites(state, table, value));
  return actions;
}

/**
 * Writes a column's logical name and what the dictionaries derive of it in
 * one dispatch, the derivation only while the physical name is empty or
 * derived; nothing when every value already holds.
 */
export const setColumnLogicalNameAction$ = (
  tableId: string,
  columnId: string,
  value: string
): GeneratorAction =>
  function* (state) {
    const actions = columnNameActions(state, [
      { tableId, columnId, logicalName: value },
    ]);
    if (actions.length) yield actions;
  };

/**
 * The logical names of several columns and what the dictionaries derive of
 * them in one dispatch, as Replace All writes them; the domains they link are
 * read over all of them at once, which separate generators would not do.
 */
export const setColumnLogicalNamesAction$ = (
  names: ReadonlyArray<{ tableId: string; columnId: string; value: string }>
): GeneratorAction =>
  function* (state) {
    const actions = columnNameActions(
      state,
      names.map(({ tableId, columnId, value }) => ({
        tableId,
        columnId,
        logicalName: value,
      }))
    );
    if (actions.length) yield actions;
  };

/** The table's logical name and its derived name, as a column's are. */
export const setTableLogicalNameAction$ = (
  tableId: string,
  value: string
): GeneratorAction =>
  function* (state) {
    const actions = tableNameActions(state, tableId, value);
    if (actions.length) yield actions;
  };

/** Derives a column's name from the logical name it holds, as its editor closes. */
export const deriveColumnNameAction$ = (
  tableId: string,
  columnId: string
): GeneratorAction =>
  function* (state) {
    const actions = columnNameActions(state, [
      { tableId, columnId, logicalName: null },
    ]);
    if (actions.length) yield actions;
  };

/** Derives a table's name from the logical name it holds, as its editor closes. */
export const deriveTableNameAction$ = (tableId: string): GeneratorAction =>
  function* (state) {
    const actions = tableNameActions(state, tableId, null);
    if (actions.length) yield actions;
  };

/** What a derivation again covers. */
export const RederiveScope = {
  column: 'column',
  table: 'table',
  selection: 'selection',
  document: 'document',
} as const;
export type RederiveScope = ValuesType<typeof RederiveScope>;

/**
 * One column; one table, its name and every column; the selected tables so;
 * or every table of the document so.
 */
export type RederiveNamesTarget =
  | { scope: typeof RederiveScope.column; tableId: string; columnId: string }
  | { scope: typeof RederiveScope.table; tableId: string }
  | { scope: typeof RederiveScope.selection }
  | { scope: typeof RederiveScope.document };

function rederivedTableIds(
  state: RootState,
  target: RederiveNamesTarget
): string[] {
  const { doc, editor } = state;
  const listed = new Set(doc.tableIds);
  const isInDoc = (id: string) => listed.has(id);

  switch (target.scope) {
    case RederiveScope.table:
      return isInDoc(target.tableId) ? [target.tableId] : [];
    case RederiveScope.selection:
      return Object.entries(editor.selectedMap)
        .filter(([id, type]) => type === SelectType.table && isInDoc(id))
        .map(([id]) => id);
    case RederiveScope.document:
      return [...doc.tableIds];
    default:
      return [];
  }
}

/**
 * Puts each name the target covers back under the dictionaries, its flag on,
 * and derives it again, one dispatch and one undo; a name with no logical
 * name, or a column whose new name another column holds, is left as it is.
 */
export const rederiveNamesAction$ = (
  target: RederiveNamesTarget
): GeneratorAction =>
  function* (state) {
    const actions: AnyAction[] = [];
    const links: ChangeColumnValuePayload[] = [];
    const ledger: ColumnNameLedger = new Map();
    const deriveColumn = (tableId: string, columnId: string) => {
      const column = columnOf(state, columnId);
      if (!column) return;

      const writes = toColumnNameWrites(
        state,
        tableId,
        column,
        column.logicalName,
        true,
        ledger
      );
      actions.push(...writes.actions);
      if (writes.link) links.push(writes.link);
    };

    if (target.scope === RederiveScope.column) {
      deriveColumn(target.tableId, target.columnId);
    }
    for (const tableId of rederivedTableIds(state, target)) {
      const table = tableOf(state, tableId);
      if (!table) continue;

      actions.push(...toTableNameWrites(state, table, table.logicalName, true));
      for (const columnId of table.columnIds) {
        deriveColumn(tableId, columnId);
      }
    }

    if (links.length) {
      actions.push(...toDomainTypeActions(state, { links }));
    }
    if (actions.length) yield actions;
  };

/**
 * Links a column to a live domain and gives it the domain's type, the data
 * type sync spreading it, in one dispatch; '' unlinks alone. A domain the
 * document does not list links nothing.
 */
export const setColumnDomainAction$ = (
  tableId: string,
  columnId: string,
  domainId: string
): GeneratorAction =>
  function* (state) {
    if (!columnOf(state, columnId)) return;
    if (domainId !== '' && !isListed(state.doc.domainIds, domainId)) return;

    const actions = toDomainTypeActions(state, {
      links: [{ tableId, id: columnId, value: domainId }],
    });
    if (actions.length) yield actions;
  };

export const actions$ = {
  addDictionaryEntryAction$,
  updateDictionaryEntryAction$,
  removeDictionaryEntriesAction$,
  importDictionaryAction$,
  commitDictionaryCellsAction$,
  setColumnLogicalNameAction$,
  setTableLogicalNameAction$,
  deriveColumnNameAction$,
  deriveTableNameAction$,
  rederiveNamesAction$,
  setColumnDomainAction$,
};
