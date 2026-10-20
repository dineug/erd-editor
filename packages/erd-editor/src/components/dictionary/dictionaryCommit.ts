import type { CommitEvent, GridSelection, RejectEvent } from '@dineug/grid';
import { isString } from 'es-toolkit';

import type { AppContext } from '@/components/appContext';
import { sheetField } from '@/components/dictionary/sheets';
import { localized } from '@/components/localized/Localized';
import { openStatusToast } from '@/components/toast-container/openStatusToast';
import {
  DictionaryKind,
  type DictionaryValues,
} from '@/engine/modules/dictionary/actions';
import {
  dictionaryIds,
  selectDictionaryRow,
} from '@/engine/modules/dictionary/atom.actions';
import {
  findDomain,
  normalizeDictionaryName,
} from '@/engine/modules/dictionary/dictionaryIndex';
import {
  type DictionaryEntryChange,
  type DictionaryRefusal,
  DictionaryRefusalCode,
  validateDictionaryValues,
} from '@/engine/modules/dictionary/entryWrites';
import {
  commitDictionaryCellsAction$,
  removeDictionaryEntriesAction$,
} from '@/engine/modules/dictionary/generator.actions';
import {
  getLiveDomainName,
  isListed,
} from '@/engine/modules/dictionary/membership';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import { sourceI18n } from '@/i18n/source';
import { type I18n, isolate, type PlainMessageKey } from '@/i18n/translate';

/** One row a commit writes: a listed row by its id, or null for one past the end. */
export type ResolvedRow = {
  id: string | null;
  /** The text each column of the commit gives, by column id. */
  cells: Readonly<Record<string, string>>;
};

/**
 * The rows one grid shows, a list per version the tab hands it. An edit is read
 * by the id of the row it opened on, which a peer's removal above cannot move,
 * a paste or a clear by the rows of the version the grid last received.
 */
export type SheetRows = {
  /** The newest version, the one the tab hands the grid next. */
  readonly version: number;
  /** The rows of the newest version. */
  readonly ids: ReadonlyArray<string>;
  /** The rows of the version the grid last received. */
  readonly receivedIds: ReadonlyArray<string>;
  /** The id of the active cell's row, null while that row shows none. */
  readonly activeId: string | null;
  /**
   * Takes the rows a batch or a search left under the next version. With no
   * edit open the active id becomes the row the grid's active cell will show;
   * an open edit keeps the row it opened on.
   */
  bump(ids: ReadonlyArray<string>, editing?: boolean): number;
  /** Notes the version the tab hands the grid as it renders; older rows are let go. */
  receive(version: number): void;
  /** Notes the active cell's row: the one onReady selects, and every one onSelectionChange reports. */
  activate(row: number): void;
  /**
   * Reads the active id again from the rows the grid shows, unless an edit is
   * open. The tab calls it as a key, a double click, a composition or an input
   * reaches the grid, in the capture phase, before any of them opens an edit.
   */
  settle(editing: boolean): void;
  /** The rows a commit writes, in row order, or none for an edit on no row. */
  resolve(event: CommitEvent): ResolvedRow[];
};

export function createSheetRows(ids: ReadonlyArray<string> = []): SheetRows {
  const snapshots = new Map<number, ReadonlyArray<string>>([[0, ids]]);
  let version = 0;
  let received = 0;
  let activeRow = 0;
  let activeId: string | null = null;

  const rowsOf = (held: number) => snapshots.get(held) ?? [];
  const idAt = (rows: ReadonlyArray<string>, row: number) =>
    row >= 0 && row < rows.length ? rows[row] : null;
  const keepOnly = (keep: (held: number) => boolean) => {
    for (const held of [...snapshots.keys()]) {
      if (!keep(held)) snapshots.delete(held);
    }
  };

  const groupCells = ({ changes }: CommitEvent): ResolvedRow[] => {
    const rows = rowsOf(received);
    const byRow = new Map<number, Record<string, string>>();

    for (const { row, columnId, value } of changes) {
      const cells = byRow.get(row) ?? {};
      cells[columnId] = value;
      byRow.set(row, cells);
    }

    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, cells]) => ({ id: idAt(rows, row), cells }));
  };

  const resolveEdit = (event: CommitEvent): ResolvedRow[] => {
    const id = activeId ?? idAt(rowsOf(received), event.changes[0]?.row ?? -1);
    const cells: Record<string, string> = {};
    for (const { columnId, value } of event.changes) cells[columnId] = value;

    // The edit has closed by the time it commits, so the active cell's row is
    // the one the grid shows there again.
    activeId = idAt(rowsOf(received), activeRow);
    return id === null ? [] : [{ id, cells }];
  };

  return {
    get version() {
      return version;
    },
    get ids() {
      return rowsOf(version);
    },
    get receivedIds() {
      return rowsOf(received);
    },
    get activeId() {
      return activeId;
    },
    bump(next, editing = false) {
      version += 1;
      snapshots.set(version, next);
      keepOnly(held => held === version || held === received);

      if (!editing || activeId === null) activeId = idAt(next, activeRow);
      return version;
    },
    receive(next) {
      if (next === received || !snapshots.has(next)) return;

      received = next;
      keepOnly(held => held >= next);
    },
    activate(row) {
      activeRow = row;
      activeId = idAt(rowsOf(received), row);
    },
    settle(editing) {
      if (!editing) activeId = idAt(rowsOf(received), activeRow);
    },
    resolve(event) {
      return event.source === 'edit' ? resolveEdit(event) : groupCells(event);
    },
  };
}

/** What a row of the commit becomes, and the domain names of it no domain has. */
type EntryWrite = {
  change: DictionaryEntryChange;
  unknownDomain: string | null;
};

/**
 * The domain a term's domain cell names, as an id: '' for a clear, the one it
 * links while the text is the name the cell showed, '' for no text, else the
 * first listed domain of that name; null when no listed domain has it.
 */
function toDomainId(
  state: RootState,
  linked: string,
  text: string,
  cleared: boolean
): string | null {
  // A clear asks for an empty cell, a removed domain's link included, which
  // shows as nothing but keeps the cell's unknown domain mark.
  if (cleared) return '';

  const name = normalizeDictionaryName(text);
  if (name === normalizeDictionaryName(getLiveDomainName(state, linked))) {
    return linked;
  }
  if (!name) return '';

  return findDomain(state, name)?.id ?? null;
}

function toEntryWrite(
  state: RootState,
  kind: DictionaryKind,
  { id, cells }: ResolvedRow,
  cleared: boolean
): EntryWrite {
  const existing = id === null ? null : selectDictionaryRow(state, kind, id);
  const values: Record<string, string> = {};
  let unknownDomain: string | null = null;

  for (const [columnId, text] of Object.entries(cells)) {
    const field = sheetField(kind, columnId);
    if (!field) continue;

    if (kind === DictionaryKind.term && field === 'domainId') {
      const linked: unknown = existing && Reflect.get(existing, 'domainId');
      const domainId = toDomainId(
        state,
        isString(linked) ? linked : '',
        text,
        cleared
      );
      if (domainId === null) unknownDomain = text.trim();
      else values.domainId = domainId;
      continue;
    }

    values[field] = text;
  }

  return {
    change: {
      ...(id === null ? {} : { id }),
      values: values as Partial<DictionaryValues[DictionaryKind]>,
    },
    unknownDomain,
  };
}

/** The refusal of a term whose domain cell names no listed domain, as the engine words one. */
function unknownDomainRefusal(
  state: RootState,
  kind: DictionaryKind,
  index: number,
  { change, unknownDomain }: EntryWrite
): DictionaryRefusal {
  const existing = change.id
    ? selectDictionaryRow(state, kind, change.id)
    : undefined;
  const name: unknown = Reflect.get(change.values, 'name') ?? existing?.name;

  return {
    code: DictionaryRefusalCode.unknownDomain,
    index,
    name: normalizeDictionaryName(isString(name) ? name : ''),
    value: unknownDomain ?? '',
  };
}

/** How many names a toast shows before it counts the rest in its number alone. */
export const NAMES_SHOWN = 3;

const REFUSAL_MESSAGE = {
  [DictionaryRefusalCode.duplicateName]: 'dictionary.toast.duplicateNames',
  [DictionaryRefusalCode.unknownDomain]: 'dictionary.toast.unknownDomainNames',
} as const;

const ROW_REMOVED = 'dictionary.toast.rowRemoved';

const GRID_REFUSAL_MESSAGE: Record<RejectEvent['reason'], PlainMessageKey> = {
  'multi-range-copy': 'dictionary.toast.multiRangeCopy',
  'paste-beyond-columns': 'dictionary.toast.pasteBeyondColumns',
  'too-many-cells': 'dictionary.toast.tooManyCells',
};

/**
 * Says what the grid refused, under one key per reason so a press repeated
 * shows one toast: a copy or a clear that did nothing is an error, while a
 * paste whose columns ran past the last wrote the rest.
 */
export function reportGridRefusal(
  { emitter }: Pick<AppContext, 'emitter'>,
  { reason }: RejectEvent
) {
  const message = GRID_REFUSAL_MESSAGE[reason];

  openStatusToast(emitter, {
    key: message,
    tone: reason === 'paste-beyond-columns' ? undefined : 'error',
    title: localized(message),
  });
}

/**
 * The names a toast shows in the reader's language, each in its own direction
 * under a right-to-left one, in a list that says no more than its items do,
 * since the number before it counts the rows it leaves out.
 */
export function formatNames(
  i18n: Pick<I18n, 'locale' | 'dir'>,
  names: ReadonlyArray<string>
): string {
  const shown = i18n.dir === 'rtl' ? names.map(isolate) : names;
  return new Intl.ListFormat(i18n.locale, { type: 'unit' }).format(shown);
}

/**
 * Reports the rows a commit was refused for, one toast per reason: how many
 * rows it refused and the first three names, a duplicated name or a domain
 * name no domain has.
 */
function reportRefusals(
  { emitter }: Pick<AppContext, 'emitter'>,
  refusals: ReadonlyArray<DictionaryRefusal>,
  i18n: Pick<I18n, 'locale' | 'dir'>
) {
  for (const code of Object.values(DictionaryRefusalCode)) {
    const refused = refusals.filter(refusal => refusal.code === code);
    if (!refused.length) continue;

    const count = new Set(refused.map(({ index }) => index)).size;
    const named = [...new Set(refused.map(({ value }) => value))].slice(
      0,
      NAMES_SHOWN
    );
    const message = REFUSAL_MESSAGE[code];

    openStatusToast(emitter, {
      key: `${message}:${count}:${named.join('\n')}`,
      tone: 'error',
      title: localized(message, { count, names: formatNames(i18n, named) }),
    });
  }
}

/**
 * Sends a grid's commit as one dispatch and one undo, a term's domain read from
 * its name, or nothing, with a toast saying why, when a row it names was
 * removed meanwhile or any of its rows is refused.
 */
export function commitDictionaryCells(
  { store, emitter }: Pick<AppContext, 'store' | 'emitter'>,
  kind: DictionaryKind,
  rows: SheetRows,
  event: CommitEvent,
  i18n: Pick<I18n, 'locale' | 'dir'> = sourceI18n
): boolean {
  const resolved = rows.resolve(event);
  if (!resolved.length) return false;

  const { state } = store;
  const listed = dictionaryIds(state, kind);
  if (resolved.some(({ id }) => id !== null && !isListed(listed, id))) {
    openStatusToast(emitter, {
      key: ROW_REMOVED,
      tone: 'error',
      title: localized(ROW_REMOVED),
    });
    return false;
  }

  const cleared = event.source === 'clear';
  const writes = resolved.map(row => toEntryWrite(state, kind, row, cleared));
  const changes = writes.map(({ change }) => change);
  const refusals = [
    ...writes.flatMap((write, index) =>
      write.unknownDomain === null
        ? []
        : [unknownDomainRefusal(state, kind, index, write)]
    ),
    ...validateDictionaryValues(state, kind, changes),
  ];

  if (refusals.length) {
    reportRefusals({ emitter }, refusals, i18n);
    return false;
  }

  store.dispatch(commitDictionaryCellsAction$(kind, changes));
  return true;
}

/** The ids of the rows a selection covers, among the rows the grid drew it over, each once in sheet order. */
export function selectedRowIds(
  rows: Pick<SheetRows, 'receivedIds'>,
  selection: GridSelection
): string[] {
  const { receivedIds } = rows;
  const last = receivedIds.length - 1;
  const picked = new Set<number>();

  for (const { startRow, endRow } of selection.ranges) {
    for (
      let row = Math.max(startRow, 0);
      row <= Math.min(endRow, last);
      row++
    ) {
      picked.add(row);
    }
  }

  return [...picked].sort((a, b) => a - b).map(row => receivedIds[row]);
}

/**
 * Removes the rows a selection covers in one dispatch, so one undo lists them
 * all again; the generator sends the removals from the end of the list back.
 */
export function removeSelectedRows(
  store: Pick<RxStore, 'dispatch'>,
  kind: DictionaryKind,
  rows: Pick<SheetRows, 'receivedIds'>,
  selection: GridSelection
): boolean {
  const ids = selectedRowIds(rows, selection);
  if (!ids.length) return false;

  store.dispatch(removeDictionaryEntriesAction$(kind, ids));
  return true;
}
