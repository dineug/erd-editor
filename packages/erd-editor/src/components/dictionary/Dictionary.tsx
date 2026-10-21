import {
  type CellContextMenuEvent,
  type CellStyleGetter,
  type CommitEvent,
  type EditorContext,
  Grid,
  type GridColumn,
  type GridHandle,
  type GridSelection,
  type GridTheme,
  type RejectEvent,
  type ViewportChange,
} from '@dineug/grid';
import {
  createRef,
  type FC,
  nextTick,
  observable,
  onMounted,
  onUpdated,
  ref,
  repeat,
  watch,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { createCheckCount } from '@/components/dictionary/checkCount';
import {
  checkCellText,
  checkDestination,
  checkRows,
  checkSheetColumns,
} from '@/components/dictionary/checkSheet';
import DictionaryContextMenu from '@/components/dictionary/dictionary-context-menu/DictionaryContextMenu';
import {
  activeTermDomain,
  commitDictionaryCells,
  commitTermDomain,
  createSheetRows,
  removeSelectedRows,
  reportGridRefusal,
  type SheetRows,
} from '@/components/dictionary/dictionaryCommit';
import {
  DICTIONARY_FILE_ACCEPT,
  DICTIONARY_FILE_FORMAT,
  exportDictionarySheet,
  importDictionaryFile,
} from '@/components/dictionary/dictionaryFile';
import {
  handleDictionaryKeydown,
  keepClipboard,
  rowChordOf,
  RowCommand,
} from '@/components/dictionary/dictionaryKeys';
import {
  changeSearch,
  clampSelection,
  dictionaryViewOf,
  rememberScroll,
  rememberSelection,
  rememberWidth,
  restoreScroll,
  storedSelection,
} from '@/components/dictionary/dictionaryView';
import { openDomainCellEditor } from '@/components/dictionary/domain-cell-editor/openDomainCellEditor';
import {
  type CellMarks,
  toCellMarks,
  toGridTheme,
} from '@/components/dictionary/gridTheme';
import {
  bumpedSheets,
  DictionarySheet,
  DictionarySheetLabelKey,
  DictionarySheetList,
  isEntrySheet,
  sheetCellMark,
  sheetCellText,
  sheetColumns,
  sheetRowIds,
} from '@/components/dictionary/sheets';
import { goToErdTarget } from '@/components/erd/goToErdTarget';
import { useI18n } from '@/components/localeContext';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { useThemeContext } from '@/components/themeContext';
import {
  DictionaryFields,
  type DictionaryKind,
} from '@/engine/modules/dictionary/actions';
import {
  type DictionaryCheck,
  DictionaryCheckLevel,
  listDictionaryChecks,
  markOf,
  walkDictionaryChecks,
} from '@/engine/modules/dictionary/checks';
import {
  type DictionaryInsertAnchor,
  DictionarySortDirection,
  insertDictionaryEntriesAction$,
  sortDictionaryAction$,
} from '@/engine/modules/dictionary/generator.actions';
import { attachDictionarySheetTag$ } from '@/engine/tag';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { I18n } from '@/i18n/translate';
import type { Theme } from '@/themes/tokens';
import { formatCount } from '@/utils/formatCount';
import { forceFocusEvent } from '@/utils/internalEvents';
import { isComposing, simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Dictionary.styles';

export type DictionaryProps = {
  readonly: boolean;
};

/**
 * The events that may open an edit, read before the grid's own listeners: a
 * beforeinput too, since text an emoji picker or dictation inserts opens one
 * with no keydown before it.
 */
const SETTLING_EVENTS = [
  'keydown',
  'dblclick',
  'compositionstart',
  'beforeinput',
] as const;

/**
 * One mount of the grid on one sheet: the rows each version handed it, the
 * checks of the check sheet, the commands the grid gave back and the
 * selection it holds, which a host's select does not echo.
 */
type SheetSession = {
  sheet: DictionarySheet;
  rows: SheetRows;
  checks: ReadonlyArray<DictionaryCheck>;
  handle: GridHandle;
  selection: GridSelection;
};

/** The commands a session answers with until its grid hands over its own. */
const NO_HANDLE: GridHandle = Object.freeze({
  scrollTo() {},
  select() {},
  focus() {},
  isEditing: () => false,
});

/** What a row button or the menu asked for, which the batch it sent settles. */
type Pending =
  | { kind: 'add'; count: number; anchor: DictionaryInsertAnchor }
  | { kind: 'remove' }
  | null;

const cellSelection = (row: number, col: number): GridSelection => ({
  active: { row, col },
  ranges: [{ startRow: row, startCol: col, endRow: row, endCol: col }],
});

/** The first column of rows first to last, the active cell on the first. */
const rowsSelection = (first: number, last: number): GridSelection => ({
  active: { row: first, col: 0 },
  ranges: [{ startRow: first, startCol: 0, endRow: last, endCol: 0 }],
});

/** How many rows a selection covers among the rows a sheet shows, each once. */
function selectedRowCount(selection: GridSelection, rowCount: number): number {
  const spans = selection.ranges
    .map(({ startRow, endRow }) => [
      Math.max(Math.min(startRow, endRow), 0),
      Math.min(Math.max(startRow, endRow), rowCount - 1),
    ])
    .filter(([start, end]) => start <= end)
    .sort(([a], [b]) => a - b);

  let count = 0;
  let reached = -1;
  for (const [start, end] of spans) {
    if (end <= reached) continue;
    count += end - Math.max(start, reached + 1) + 1;
    reached = end;
  }
  return count;
}

/** The first row a selection covers, where the active cell lands once its rows are removed. */
const topRow = ({ active, ranges }: GridSelection) =>
  ranges.reduce(
    (top, { startRow, endRow }) => Math.min(top, startRow, endRow),
    active.row
  );

/** The last row a selection covers, after which the menu's Insert below goes. */
const bottomRow = ({ active, ranges }: GridSelection) =>
  ranges.reduce(
    (bottom, { startRow, endRow }) => Math.max(bottom, startRow, endRow),
    active.row
  );

/** Where count rows inserted by an anchor begin among the rows shown: beside it, or last of all once it is gone. */
function insertedStart(
  ids: ReadonlyArray<string>,
  count: number,
  anchor: DictionaryInsertAnchor
): number {
  const at = anchor ? ids.indexOf(anchor.id) : -1;
  if (!anchor || at === -1) return ids.length - count;
  return anchor.place === 'after' ? at + 1 : at - count;
}

/** A sheet's columns, a term's domain picked from a list as the ERD tab's domain cell is. */
const withDomainPicker = (
  sheet: DictionarySheet,
  columns: GridColumn[],
  openPicker: (editor: EditorContext, label: string) => void
): GridColumn[] =>
  sheet === DictionarySheet.term
    ? columns.map(column =>
        column.id === 'domainId'
          ? {
              ...column,
              editor: editor => openPicker(editor, column.label),
            }
          : column
      )
    : columns;

/**
 * The Dictionary tab: the sheet switch, the search and the row and file tools
 * over a grid of the sheet shown, and its row count and selection under it.
 * Every edit, paste or clear the grid commits is one dispatch and one undo.
 */
const Dictionary: FC<DictionaryProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const theme = useThemeContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const sheetRef = createRef<HTMLDivElement>();
  const fileRef = createRef<HTMLInputElement>();
  const searchRef = createRef<HTMLDivElement>();
  const contextMenu = useContextMenuRootProvider(ctx);
  const view = dictionaryViewOf(app.value);

  // The render reads the sheet shown here, not off the session: two empty
  // sheets open on the same counts, so a switch between them moves nothing else.
  const state = observable({
    sheet: view.sheet,
    version: 0,
    rowCount: 0,
    selectedRows: 0,
    empty: false,
    // What each sheet button counts: the listed rows, and the checks with the
    // loudest of their levels, which colours the check sheet's count.
    counts: { word: 0, term: 0, domain: 0, check: 0 } as Record<
      DictionarySheet,
      number
    >,
    checkMark: null as DictionaryCheckLevel | null,
  });

  let session = openSession(view.sheet);
  countEntries();
  let pending: Pending = null;
  let revealRows: { first: number; last: number } | null = null;
  // The column a menu opened on, which its sorts order the sheet by, or none
  // right of the last column.
  let menuColumn: GridColumn | null = null;
  let checksFrame: number | null = null;
  // While an entry sheet shows, the checks are counted over the idle periods
  // after a batch that raises them, a walk under way dropped, since the batch
  // may have changed what it walked; the check sheet counts as it lists them.
  const checkCount = createCheckCount({
    walk: () => walkDictionaryChecks(app.value.store.state),
    wanted: () => isEntrySheet(session.sheet),
    done: countChecks,
  });
  let gridTheme: Readonly<GridTheme> | undefined;

  let columns: GridColumn[] = [];
  let columnsKey: ReadonlyArray<unknown> = [];

  let cellMarks: CellMarks | undefined;
  let getCellStyle: CellStyleGetter = () => undefined;

  /** The columns handed to the grid, new only when what they are made from is, since a new array resets the grid's. */
  function columnsOf(sheet: DictionarySheet, i18nValue: I18n): GridColumn[] {
    const { widths } = view.sheets[sheet];
    const key = [sheet, props.readonly, widths, i18nValue.t];
    if (key.every((part, index) => part === columnsKey[index])) return columns;

    columnsKey = key;
    columns = isEntrySheet(sheet)
      ? withDomainPicker(
          sheet,
          sheetColumns(sheet, { readonly: props.readonly, widths }, i18nValue),
          openDomainPicker
        )
      : checkSheetColumns(widths, i18nValue);
    return columns;
  }

  /**
   * Opens a term's domain picker on the domain its row links, a pick linking
   * that row by the id picked. Its close may send no batch, so a selection a
   * removal under it left past the last row is held inside the rows there.
   */
  function openDomainPicker(editor: EditorContext, label: string) {
    const { rows } = session;
    openDomainCellEditor(editor, {
      label,
      linkedId: activeTermDomain(app.value.store.state, rows),
      onPick: option => commitTermDomain(app.value, rows, option, i18n.value),
      onClose: () => {
        const held = heldInside(state.rowCount);
        if (held) refresh(held);
      },
    });
  }

  /**
   * The style getter handed to the grid, new only with the mark colours, since
   * the grid draws again on a new getter. What a row's checks find changes
   * with its sheet's version, which draws the sheet again anyway.
   */
  function cellStyleOf(themeValue: Theme): CellStyleGetter {
    const marks = toCellMarks(themeValue, cellMarks);
    if (marks === cellMarks) return getCellStyle;

    cellMarks = marks;
    getCellStyle = (row, col) => {
      const { sheet, rows } = session;
      const column = columns[col];
      const id = rows.ids[row];
      if (!isEntrySheet(sheet) || !column || id === undefined) return;

      const level = sheetCellMark(app.value.store.state, sheet, id, column.id);
      return level ? marks[level] : undefined;
    };
    return getCellStyle;
  }

  function countSelected() {
    state.selectedRows = selectedRowCount(session.selection, state.rowCount);
  }

  /**
   * The selection held inside the rows a batch left, once it reaches past the
   * last of them, the first row kept on a sheet with none; none while it fits
   * or an edit is open, which keeps the row it opened on.
   */
  function heldInside(rowCount: number): GridSelection | undefined {
    const { selection, handle } = session;
    const end = Math.max(rowCount, 1);
    const past =
      selection.active.row >= end ||
      selection.ranges.some(
        ({ startRow, endRow }) => Math.max(startRow, endRow) >= end
      );
    if (!past || handle.isEditing()) return;

    return clampSelection(selection, rowCount, columns.length);
  }

  /**
   * Takes the rows of the sheet shown again under the next version, after
   * handing the grid the selection given or the one it holds cut to the rows
   * left. Rows are read here, never in the render: reading walks the proxies.
   */
  function refresh(select?: GridSelection) {
    const { store } = app.value;
    const { sheet, handle, rows } = session;
    const { search } = view.sheets[sheet];
    const entry = isEntrySheet(sheet);
    const ids = entry ? sheetRowIds(store.state, sheet, search) : [];
    if (!entry) session.checks = listChecks(search);

    const selection =
      select ?? heldInside(entry ? ids.length : session.checks.length);
    if (selection) {
      handle.select(selection);
      session.selection = selection;
      rows.activate(selection.active.row);
      rememberSelection(view, sheet, selection);
    }

    if (entry) {
      state.version = rows.bump(ids, handle.isEditing());
      state.rowCount = ids.length;
      state.empty = sheetRowIds(store.state, sheet).length === 0;
    } else {
      state.version += 1;
      state.rowCount = session.checks.length;
      state.empty = false;
    }
    countSelected();
  }

  /** Counts the listed rows of each entry sheet, which their buttons show. */
  function countEntries() {
    const { state: rootState } = app.value.store;
    state.counts = {
      ...state.counts,
      word: sheetRowIds(rootState, DictionarySheet.word).length,
      term: sheetRowIds(rootState, DictionarySheet.term).length,
      domain: sheetRowIds(rootState, DictionarySheet.domain).length,
    };
  }

  /** Puts the number of checks and the loudest of their levels on the check sheet's button. */
  function countChecks(count: number, mark: DictionaryCheckLevel | null) {
    state.counts = { ...state.counts, check: count };
    state.checkMark = mark;
  }

  /** The check sheet's rows under the search, counted on the way from the one walk. */
  function listChecks(search: string): ReadonlyArray<DictionaryCheck> {
    const { state: rootState } = app.value.store;
    const checks = listDictionaryChecks(rootState);
    countChecks(checks.length, markOf(checks));
    return checkRows(rootState, search, i18n.value, checks);
  }

  /**
   * Lists the checks again on the next frame, once however many batches come
   * before it, since a list walks the whole document and a peer's drag sends a
   * batch every frame. A switch away by then has listed nothing to redo.
   */
  function refreshChecks() {
    if (checksFrame !== null) return;

    // A switch to an entry sheet by then still owes the check sheet's count.
    checksFrame = requestAnimationFrame(() => {
      checksFrame = null;
      if (!isEntrySheet(session.sheet)) refresh();
      else checkCount.restart();
    });
  }

  function openSession(sheet: DictionarySheet): SheetSession {
    const { store } = app.value;
    const { search } = view.sheets[sheet];
    const ids = isEntrySheet(sheet)
      ? sheetRowIds(store.state, sheet, search)
      : [];
    const checks = isEntrySheet(sheet) ? [] : listChecks(search);

    state.sheet = sheet;
    state.version = 0;
    state.rowCount = isEntrySheet(sheet) ? ids.length : checks.length;
    state.empty =
      isEntrySheet(sheet) && sheetRowIds(store.state, sheet).length === 0;
    state.selectedRows = 0;

    return {
      sheet,
      rows: createSheetRows(ids),
      checks,
      handle: NO_HANDLE,
      selection: storedSelection(view, sheet, 0, 0),
    };
  }

  const closeMenu = () => {
    contextMenu.state.show = false;
  };

  /**
   * A press on the menu keeps the keyboard where it was, so Escape and the
   * keys after a pick still reach the tab; a press elsewhere in it shuts it.
   */
  const handleMousedown = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.context-menu-content')) event.preventDefault();
    contextMenu.onMousedown(event);
  };

  const switchSheet = (sheet: DictionarySheet) => {
    if (sheet === session.sheet) return;

    closeMenu();
    view.sheet = sheet;
    session = openSession(sheet);
  };

  const getCell = (row: number, col: number): string => {
    const column = columns[col];
    if (!column) return '';

    const { state: rootState } = app.value.store;
    const { sheet } = session;
    if (isEntrySheet(sheet)) {
      const id = session.rows.ids[row];
      return id === undefined
        ? ''
        : sheetCellText(rootState, sheet, id, column.id);
    }

    const check = session.checks[row];
    return check ? checkCellText(rootState, check, column.id, i18n.value) : '';
  };

  const handleReady = (handle: GridHandle) => {
    const { sheet } = session;
    const selection = storedSelection(
      view,
      sheet,
      state.rowCount,
      columns.length
    );

    session.handle = handle;
    session.selection = selection;
    handle.select(selection);
    session.rows.activate(selection.active.row);
    restoreScroll(handle, view, sheet, state.rowCount, columns.length);
    handle.focus();
    countSelected();
  };

  // The menu counts the rows of the selection it opened on, so it goes with it.
  const handleSelectionChange = (selection: GridSelection) => {
    closeMenu();
    session.selection = selection;
    session.rows.activate(selection.active.row);
    rememberSelection(view, session.sheet, selection);
    countSelected();
  };

  const handleViewportChange = (viewport: ViewportChange) => {
    rememberScroll(view, session.sheet, viewport);
  };

  const handleColumnResize = (col: number, width: number) => {
    rememberWidth(view, session.sheet, columns[col].id, width);
  };

  // The grid hands a paste's commit, then its refusal of the columns past the
  // last, within the one paste event, so the refusal reads whether the commit
  // before it landed; one that wrote nothing has nothing to say of the rest.
  let pasteLanded = false;

  const handleCommit = (event: CommitEvent) => {
    const { sheet, rows } = session;
    if (!isEntrySheet(sheet)) return;

    const landed = commitDictionaryCells(
      app.value,
      sheet,
      rows,
      event,
      i18n.value
    );
    if (landed && event.source === 'paste') {
      pasteLanded = true;
      queueMicrotask(() => {
        pasteLanded = false;
      });
    }
  };

  const handleReject = (event: RejectEvent) => {
    if (event.reason === 'paste-beyond-columns' && !pasteLanded) return;
    reportGridRefusal(app.value, event);
  };

  const search = (text: string) => {
    const { sheet } = session;
    changeSearch(view, sheet, text);
    refresh(storedSelection(view, sheet, state.rowCount, columns.length));
    session.handle.scrollTo(0, 0);
  };

  const handleSearch = (event: InputEvent) => {
    search((event.target as HTMLInputElement).value);
  };

  /** A sheet button's count, the check sheet's in the colour of its loudest check. */
  const countClass = (item: DictionarySheet) => {
    if (item !== DictionarySheet.check || state.counts.check === 0) {
      return styles.count;
    }
    return state.checkMark === DictionaryCheckLevel.error
      ? styles.countError
      : styles.countWarning;
  };

  /** A tool's tooltip: its name, and the chord that does the same in the grid while one is bound. */
  const withChord = (name: string, shortcut?: string) =>
    shortcut ? `${name} (${simpleShortcutToString(shortcut)})` : name;

  /** Empties the search and hands the field the keyboard back. */
  const clearSearch = () => {
    search('');
    searchRef.value?.querySelector('input')?.focus();
  };

  // Escape empties a search first, as a field's own clear does, and goes on
  // as before once there is nothing to clear.
  const handleSearchKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || isComposing(event)) return;
    if (!view.sheets[session.sheet].search) return;

    event.preventDefault();
    event.stopPropagation();
    clearSearch();
  };

  /** Inserts empty rows by a row, or at the end for none, in one dispatch. */
  const insertRows = (count: number, anchor: DictionaryInsertAnchor) => {
    const { sheet } = session;
    if (!isEntrySheet(sheet)) return;

    // A row starts with no name, which no search finds, so the search goes.
    if (view.sheets[sheet].search) {
      changeSearch(view, sheet, '');
      refresh(storedSelection(view, sheet, state.rowCount, columns.length));
    }
    pending = { kind: 'add', count, anchor };
    app.value.store.dispatch(
      attachDictionarySheetTag$(
        insertDictionaryEntriesAction$(sheet, count, anchor)
      )
    );
    session.handle.focus();
  };

  const handleAddRow = () => insertRows(1, null);

  const handleDeleteRows = () => {
    const { sheet, rows, selection } = session;
    if (!isEntrySheet(sheet)) return;

    if (removeSelectedRows(app.value.store, sheet, rows, selection)) {
      pending = { kind: 'remove' };
    }
    session.handle.focus();
  };

  /**
   * Opens the menu where a right click on a cell or past the last one, or the
   * menu key on the active cell, asked for it; past the last one it acts on the
   * selection as it stands.
   */
  const handleCellContextMenu = ({
    col,
    clientX,
    clientY,
  }: CellContextMenuEvent) => {
    menuColumn = col === null ? null : (columns[col] ?? null);
    const menu = contextMenu.state;
    menu.x = clientX;
    menu.y = clientY;
    // Shut first, so a menu open elsewhere opens again where it is asked for.
    menu.show = false;
    nextTick(() => {
      menu.show = true;
    });
  };

  /** The rows the menu acts on: those the selection covers, the active row at least. */
  const menuRowCount = () => Math.max(state.selectedRows, 1);

  /** The first and the last row the selection covers, among the rows the grid received. */
  const selectedEnds = () => {
    const { selection, rows } = session;
    return {
      top: rows.ids[topRow(selection)],
      bottom: rows.ids[bottomRow(selection)],
    };
  };

  const handleMenuInsertAbove = () => {
    closeMenu();
    const { top } = selectedEnds();
    insertRows(menuRowCount(), top ? { id: top, place: 'before' } : null);
  };

  const handleMenuInsertBelow = () => {
    closeMenu();
    const { bottom } = selectedEnds();
    insertRows(menuRowCount(), bottom ? { id: bottom, place: 'after' } : null);
  };

  /** Sorts the whole sheet by the column right clicked, for everyone, in one undo. */
  const sortRows = (direction: DictionarySortDirection) => {
    closeMenu();
    const { sheet } = session;
    if (!isEntrySheet(sheet) || !menuColumn) return;

    app.value.store.dispatch(
      attachDictionarySheetTag$(
        sortDictionaryAction$(
          sheet,
          menuColumn.id,
          direction,
          i18n.value.locale
        )
      )
    );
    session.handle.focus();
  };

  const handleMenuDeleteRows = () => {
    closeMenu();
    handleDeleteRows();
  };

  const handleMenuImport = () => {
    closeMenu();
    handleImport();
  };

  const handleMenuExport = () => {
    closeMenu();
    handleExport();
    session.handle.focus();
  };

  const handleImport = () => {
    fileRef.value?.click();
  };

  /** Imports the file picked into the dictionary its header names, and shows that sheet. */
  const handleFileChange = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Emptied, so the same file picked again is a change too.
    input.value = '';
    if (!file) return;

    const kind = await importDictionaryFile(app.value, file, i18n.value);
    if (!kind) return;

    switchSheet(kind);
    session.handle.focus();
  };

  const handleExport = () => {
    const { sheet } = session;
    if (!isEntrySheet(sheet)) return;

    exportDictionarySheet(app.value.store.state, sheet);
  };

  /** Where the active cell goes once a row button's batch lands: over the added rows, last of all, or where the removed rows began. */
  const selectionAfter = (asked: Pending): GridSelection | undefined => {
    const { sheet, selection } = session;
    if (!asked || !isEntrySheet(sheet)) return;

    const ids = sheetRowIds(
      app.value.store.state,
      sheet,
      view.sheets[sheet].search
    );
    if (!ids.length) return;

    if (asked.kind === 'add') {
      const { anchor, count } = asked;
      const start = insertedStart(ids, count, anchor);
      const first = Math.min(Math.max(start, 0), ids.length - 1);
      const last = Math.min(first + count - 1, ids.length - 1);
      revealRows = { first, last };
      return rowsSelection(first, last);
    }
    return cellSelection(
      Math.min(topRow(selection), ids.length - 1),
      selection.active.col
    );
  };

  /**
   * Shows a dictionary row on its own sheet, the cell a check names selected
   * and its row first in view, the sheet's search cleared while it hides the
   * row. A row the document no longer lists goes nowhere.
   */
  const showEntry = (kind: DictionaryKind, id: string, columnId: string) => {
    const { state: rootState } = app.value.store;
    const { search } = view.sheets[kind];
    let row = sheetRowIds(rootState, kind, search).indexOf(id);

    if (row === -1) {
      row = sheetRowIds(rootState, kind).indexOf(id);
      if (row === -1) return;
      changeSearch(view, kind, '');
    }

    const fields: ReadonlyArray<string> = DictionaryFields[kind];
    const col = Math.max(fields.indexOf(columnId), 0);
    rememberSelection(view, kind, cellSelection(row, col));
    // The grid the switch mounts selects and scrolls back to what is kept.
    rememberScroll(view, kind, { rowStart: row, colStart: 0 });
    switchSheet(kind);
  };

  /** Goes where a check points: its dictionary row, or its table's or column's cell on the ERD tab, which takes the keyboard. */
  const goToCheck = (row: number) => {
    const check = session.checks[row];
    if (!check) return;

    const destination = checkDestination(check);
    if (destination.kind === 'entry') {
      showEntry(destination.sheet, destination.id, destination.columnId);
      return;
    }

    goToErdTarget(app.value.store, destination.target);
    // The grid that held the keyboard goes with the tab.
    ctx.host.dispatchEvent(forceFocusEvent());
  };

  /** Whether a press lands on the active cell, over which the grid keeps its focus textarea. */
  const onActiveCell = ({ clientX, clientY }: MouseEvent) => {
    const focus = sheetRef.value?.querySelector('textarea');
    if (!focus) return false;

    const { left, top, right, bottom } = focus.getBoundingClientRect();
    return (
      clientX >= left && clientX < right && clientY >= top && clientY < bottom
    );
  };

  /** A double click on a check goes to it; one on a header, an edge or a scrollbar goes nowhere. */
  const handleSheetDoubleClick = (event: MouseEvent) => {
    if (session.sheet !== DictionarySheet.check || !onActiveCell(event)) return;
    goToCheck(session.selection.active.row);
  };

  /**
   * Enter on a check goes to it, as the grid opens no edit on its read-only
   * cells. It stops here: the tab's root, which would stop it, is gone by
   * then, and the canvas would read it as an edit of the cell it went to.
   */
  const handleSheetKeydown = (event: KeyboardEvent) => {
    if (session.sheet !== DictionarySheet.check || isComposing(event)) return;

    const modified =
      event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
    if (event.key !== 'Enter' || modified) return;

    event.stopPropagation();
    goToCheck(session.selection.active.row);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const { keyBindingMap, store } = app.value;

    // Escape shuts an open menu and goes no further, as the root's stop would.
    if (contextMenu.state.show && event.key === 'Escape') {
      event.stopPropagation();
      closeMenu();
      return;
    }

    handleDictionaryKeydown(event, {
      keyBindingMap,
      undo: () => {
        if (isEntrySheet(session.sheet)) store.undoSheet(session.sheet);
      },
      redo: () => {
        if (isEntrySheet(session.sheet)) store.redoSheet(session.sheet);
      },
      inGrid: event.composedPath().includes(sheetRef.value as EventTarget),
      isEditing: () => session.handle.isEditing(),
      insertRows: () => {
        if (!props.readonly) handleMenuInsertBelow();
      },
      insertRowsAbove: () => {
        if (!props.readonly) handleMenuInsertAbove();
      },
      deleteRows: () => {
        if (!props.readonly) handleMenuDeleteRows();
      },
    });
  };

  /** Reads the active row again before a press can open an edit on it, unless one is open. */
  const settle = () => {
    session.rows.settle(session.handle.isEditing());
  };

  onMounted(() => {
    const { store } = app.value;
    const $sheet = sheetRef.value as HTMLDivElement;

    SETTLING_EVENTS.forEach(type =>
      $sheet.addEventListener(type, settle, { capture: true })
    );
    addUnsubscribe(() =>
      SETTLING_EVENTS.forEach(type =>
        $sheet.removeEventListener(type, settle, { capture: true })
      )
    );

    addUnsubscribe(
      store.subscribe(actions => {
        const bumped = bumpedSheets(actions);
        if (bumped.some(isEntrySheet)) countEntries();
        if (bumped.length) checkCount.restart();
        if (!bumped.includes(session.sheet)) return;
        // The rows the menu counted may have moved under it.
        closeMenu();
        if (!isEntrySheet(session.sheet)) return refreshChecks();

        const asked = pending;
        pending = null;
        refresh(selectionAfter(asked));
      }),
      // A document turned read-only takes no row or file command.
      watch(props).subscribe(name => {
        if (name === 'readonly') closeMenu();
      }),
      // The check sheet's search reads its cells in the language shown, which
      // a switch changes in place without a batch.
      watch(i18n.value).subscribe(name => {
        if (name === 'locale' && session.sheet === DictionarySheet.check) {
          refresh();
        }
      }),
      () => {
        if (checksFrame !== null) cancelAnimationFrame(checksFrame);
        checkCount.stop();
      }
    );
    checkCount.restart();
  });

  // The grid takes a new row count a tick after the render that hands it over,
  // so the added rows are scrolled to once that tick has run: the last first,
  // since a scroll goes the least distance, so the first new row stays in view.
  onUpdated(() => {
    const rows = revealRows;
    if (rows === null) return;

    revealRows = null;
    nextTick(() => {
      session.handle.scrollTo(rows.last, 0);
      session.handle.scrollTo(rows.first, 0);
    });
  });

  return () => {
    const i18nValue = i18n.value;
    const { t } = i18nValue;
    const { sheet, version, rowCount, selectedRows, empty } = state;
    const entry = isEntrySheet(sheet);
    const gridColumns = columnsOf(sheet, i18nValue);

    gridTheme = toGridTheme(theme.value, gridTheme);
    const cellStyle = cellStyleOf(theme.value);
    session.rows.receive(version);

    return (
      <div
        class={['dictionary', styles.root]}
        on:keydown={handleKeydown}
        on:mousedown={handleMousedown}
        on:copy={keepClipboard}
        on:cut={keepClipboard}
        on:paste={keepClipboard}
      >
        <div class={styles.bar}>
          <div
            class={styles.segments}
            role="group"
            aria-label={t('common.tab.dictionary')}
          >
            {DictionarySheetList.map(item => (
              <button
                type="button"
                class={styles.segment}
                aria-pressed={item === sheet ? 'true' : 'false'}
                on:click={() => switchSheet(item)}
              >
                <span>{t(DictionarySheetLabelKey[item])}</span>
                <span class={countClass(item)} aria-hidden="true">
                  {formatCount(i18nValue.locale, state.counts[item])}
                </span>
              </button>
            ))}
          </div>
          <div class={styles.searchField} use:ref={ref(searchRef)}>
            <span class={styles.searchIcon}>
              <Icon name="search" size={14} />
            </span>
            <TextInput
              class={styles.search}
              title={t('common.search')}
              placeholder={t('common.search')}
              dir="auto"
              value={view.sheets[sheet].search}
              onInput={handleSearch}
              onKeydown={handleSearchKeydown}
            />
            {view.sheets[sheet].search ? (
              <button
                type="button"
                class={styles.clear}
                title={t('dictionary.clearSearch')}
                aria-label={t('dictionary.clearSearch')}
                on:click={clearSearch}
              >
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>
          {entry && !props.readonly ? (
            <div class={styles.tools}>
              <button
                type="button"
                class={styles.tool}
                title={t('dictionary.addRow')}
                aria-label={t('dictionary.addRow')}
                on:click={handleAddRow}
              >
                <Icon name="list-plus" size={16} />
              </button>
              <button
                type="button"
                class={[styles.tool, styles.toolDanger]}
                title={withChord(
                  t('dictionary.deleteRows'),
                  rowChordOf(app.value.keyBindingMap, RowCommand.deleteRows)
                )}
                aria-label={t('dictionary.deleteRows')}
                on:click={handleDeleteRows}
              >
                <Icon name="list-x" size={16} />
              </button>
              <span class={styles.divider} aria-hidden="true" />
              <button
                type="button"
                class={styles.tool}
                title={t('dictionary.import', {
                  format: DICTIONARY_FILE_FORMAT,
                })}
                aria-label={t('dictionary.import', {
                  format: DICTIONARY_FILE_FORMAT,
                })}
                on:click={handleImport}
              >
                <Icon name="upload" size={16} />
              </button>
              <button
                type="button"
                class={styles.tool}
                title={t('dictionary.export', {
                  format: DICTIONARY_FILE_FORMAT,
                })}
                aria-label={t('dictionary.export', {
                  format: DICTIONARY_FILE_FORMAT,
                })}
                on:click={handleExport}
              >
                <Icon name="download" size={16} />
              </button>
              <input
                type="file"
                prop:accept={DICTIONARY_FILE_ACCEPT}
                hidden
                use:ref={ref(fileRef)}
                on:change={handleFileChange}
              />
            </div>
          ) : null}
        </div>
        <div
          class={styles.sheet}
          use:ref={ref(sheetRef)}
          on:keydown={handleSheetKeydown}
          on:dblclick={handleSheetDoubleClick}
        >
          {repeat(
            [sheet],
            key => key,
            () => (
              <Grid
                rowCount={rowCount}
                columns={gridColumns}
                getCell={getCell}
                getCellStyle={cellStyle}
                theme={gridTheme}
                version={version}
                ariaLabel={t(DictionarySheetLabelKey[sheet])}
                onCommit={handleCommit}
                onReject={handleReject}
                onCellContextMenu={
                  entry && !props.readonly ? handleCellContextMenu : undefined
                }
                onSelectionChange={handleSelectionChange}
                onViewportChange={handleViewportChange}
                onColumnResize={handleColumnResize}
                onReady={handleReady}
              />
            )
          )}
          {empty && !props.readonly ? (
            <p class={styles.empty}>
              {t('dictionary.empty', { format: DICTIONARY_FILE_FORMAT })}
            </p>
          ) : null}
        </div>
        {contextMenu.state.show && entry && !props.readonly ? (
          <DictionaryContextMenu
            count={menuRowCount()}
            column={menuColumn?.label ?? null}
            empty={rowCount === 0}
            insertAboveShortcut={rowChordOf(
              app.value.keyBindingMap,
              RowCommand.insertAbove
            )}
            insertShortcut={rowChordOf(
              app.value.keyBindingMap,
              RowCommand.insertBelow
            )}
            deleteShortcut={rowChordOf(
              app.value.keyBindingMap,
              RowCommand.deleteRows
            )}
            onInsertAbove={handleMenuInsertAbove}
            onInsertBelow={handleMenuInsertBelow}
            onDeleteRows={handleMenuDeleteRows}
            onSortAscending={() => sortRows(DictionarySortDirection.ascending)}
            onSortDescending={() =>
              sortRows(DictionarySortDirection.descending)
            }
            onImport={handleMenuImport}
            onExport={handleMenuExport}
          />
        ) : null}
        <div class={styles.status}>
          <span>{t('dictionary.rowCount', { count: rowCount })}</span>
          {selectedRows > 0 ? (
            <span>
              {t('dictionary.selectedCount', { count: selectedRows })}
            </span>
          ) : null}
        </div>
      </div>
    );
  };
};

export default Dictionary;
