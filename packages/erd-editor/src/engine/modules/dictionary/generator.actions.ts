import { query } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';

import { GeneratorAction } from '@/engine/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { changeTableLogicalNameAction } from '@/engine/modules/table/atom.actions';
import type { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { changeColumnLogicalNameAction } from '@/engine/modules/table-column/atom.actions';
import type { RootState } from '@/engine/state';
import type { ValuesType } from '@/internal-types';
import type { DictionaryCsvRow } from '@/utils/dictionary-csv/dictionaryCsv';

import { DictionaryKind, DictionaryValues } from './actions';
import {
  dictionaryIds,
  hasDictionaryKind,
  removeDictionaryAction,
} from './atom.actions';
import { toColumnNameWrites, toTableNameWrites } from './derivedNames';
import { toDomainTypeActions } from './domainTypes';
import {
  DictionaryEntryChange,
  toDictionaryCommit,
  toDictionaryImport,
} from './entryWrites';
import { isListed } from './membership';

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

/** Removes each listed row named, once, in one dispatch. */
export const removeDictionaryEntriesAction$ = (
  kind: DictionaryKind,
  ids: ReadonlyArray<string>
): GeneratorAction =>
  function* (state) {
    if (!hasDictionaryKind(kind)) return;

    const listed = dictionaryIds(state, kind);
    const removed = new Set(ids.filter(id => isListed(listed, id)));
    if (removed.size) {
      yield [...removed].map(id => removeDictionaryAction({ kind, id }));
    }
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

/** The column writes of a logical name and the domain it links, in one list. */
function columnNameActions(
  state: RootState,
  tableId: string,
  columnId: string,
  logicalName: string | null
): AnyAction[] {
  const column = columnOf(state, columnId);
  if (!column) return [];

  const value = logicalName ?? column.logicalName;
  const actions: AnyAction[] =
    logicalName !== null && logicalName !== column.logicalName
      ? [changeColumnLogicalNameAction({ tableId, id: columnId, value })]
      : [];
  const writes = toColumnNameWrites(state, tableId, column, value);

  actions.push(...writes.actions);
  if (writes.link) {
    actions.push(...toDomainTypeActions(state, { links: [writes.link] }));
  }
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
    const actions = columnNameActions(state, tableId, columnId, value);
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
    const actions = columnNameActions(state, tableId, columnId, null);
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
 * and derives it again from its logical name, one dispatch and one undo; a
 * name with no logical name is left as it is.
 */
export const rederiveNamesAction$ = (
  target: RederiveNamesTarget
): GeneratorAction =>
  function* (state) {
    const actions: AnyAction[] = [];
    const links: ChangeColumnValuePayload[] = [];
    const deriveColumn = (tableId: string, columnId: string) => {
      const column = columnOf(state, columnId);
      if (!column) return;

      const writes = toColumnNameWrites(
        state,
        tableId,
        column,
        column.logicalName,
        true
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
