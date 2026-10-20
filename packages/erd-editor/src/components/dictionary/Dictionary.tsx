import {
  type CommitEvent,
  Grid,
  type GridColumn,
  type GridHandle,
  type GridSelection,
  type GridTheme,
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
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  checkCellText,
  checkRows,
  checkSheetColumns,
} from '@/components/dictionary/checkSheet';
import {
  commitDictionaryCells,
  createSheetRows,
  removeSelectedRows,
  type SheetRows,
} from '@/components/dictionary/dictionaryCommit';
import {
  handleDictionaryKeydown,
  keepClipboard,
} from '@/components/dictionary/dictionaryKeys';
import {
  changeSearch,
  dictionaryViewOf,
  rememberScroll,
  rememberSelection,
  rememberWidth,
  restoreScroll,
  storedSelection,
} from '@/components/dictionary/dictionaryView';
import { toGridTheme } from '@/components/dictionary/gridTheme';
import {
  bumpedSheets,
  DictionarySheet,
  DictionarySheetLabelKey,
  DictionarySheetList,
  isEntrySheet,
  sheetCellText,
  sheetColumns,
  sheetRowIds,
} from '@/components/dictionary/sheets';
import { useI18n } from '@/components/localeContext';
import Button from '@/components/primitives/button/Button';
import TextInput from '@/components/primitives/text-input/TextInput';
import { useThemeContext } from '@/components/themeContext';
import type { DictionaryCheck } from '@/engine/modules/dictionary/checks';
import { addDictionaryEntryAction$ } from '@/engine/modules/dictionary/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { I18n } from '@/i18n/translate';

import * as styles from './Dictionary.styles';

export type DictionaryProps = {
  readonly: boolean;
};

/** The file format the empty sheet's hint names, which no language translates. */
const CSV = 'CSV';

/** The presses that may open an edit, read before the grid's own listeners. */
const SETTLING_EVENTS = ['keydown', 'dblclick', 'compositionstart'] as const;

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

/** What a row button asked for, which the batch it sent settles. */
type Pending = 'add' | 'remove' | null;

const cellSelection = (row: number, col: number): GridSelection => ({
  active: { row, col },
  ranges: [{ startRow: row, startCol: col, endRow: row, endCol: col }],
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

/**
 * The Dictionary tab: the sheet switch, the search and the row buttons over a
 * grid of the sheet shown, and its row count and selection under it. Every
 * edit, paste or clear the grid commits is one dispatch and one undo.
 */
const Dictionary: FC<DictionaryProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const theme = useThemeContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const sheetRef = createRef<HTMLDivElement>();
  const view = dictionaryViewOf(app.value);

  const state = observable({
    version: 0,
    rowCount: 0,
    selectedRows: 0,
    empty: false,
  });

  let session = openSession(view.sheet);
  let pending: Pending = null;
  let revealRow: number | null = null;
  let gridTheme: Readonly<GridTheme> | undefined;

  let columns: GridColumn[] = [];
  let columnsKey: ReadonlyArray<unknown> = [];

  /** The columns handed to the grid, new only when what they are made from is, since a new array resets the grid's. */
  function columnsOf(sheet: DictionarySheet, i18nValue: I18n): GridColumn[] {
    const { widths } = view.sheets[sheet];
    const key = [sheet, props.readonly, widths, i18nValue.t];
    if (key.every((part, index) => part === columnsKey[index])) return columns;

    columnsKey = key;
    columns = isEntrySheet(sheet)
      ? sheetColumns(sheet, { readonly: props.readonly, widths }, i18nValue)
      : checkSheetColumns(widths, i18nValue);
    return columns;
  }

  function countSelected() {
    state.selectedRows = selectedRowCount(session.selection, state.rowCount);
  }

  /**
   * Takes the rows of the sheet shown again under the next version, after
   * handing the grid a selection when one is given. Rows are read here, never
   * in the render, since reading them walks the store's proxies.
   */
  function refresh(select?: GridSelection) {
    const { store } = app.value;
    const { sheet, handle, rows } = session;
    const { search } = view.sheets[sheet];

    if (select) {
      handle.select(select);
      session.selection = select;
      rows.activate(select.active.row);
      rememberSelection(view, sheet, select);
    }

    if (isEntrySheet(sheet)) {
      const ids = sheetRowIds(store.state, sheet, search);
      state.version = rows.bump(ids, handle.isEditing());
      state.rowCount = ids.length;
      state.empty = sheetRowIds(store.state, sheet).length === 0;
    } else {
      session.checks = checkRows(store.state, search, i18n.value);
      state.version += 1;
      state.rowCount = session.checks.length;
      state.empty = false;
    }
    countSelected();
  }

  function openSession(sheet: DictionarySheet): SheetSession {
    const { store } = app.value;
    const { search } = view.sheets[sheet];
    const ids = isEntrySheet(sheet)
      ? sheetRowIds(store.state, sheet, search)
      : [];
    const checks = isEntrySheet(sheet)
      ? []
      : checkRows(store.state, search, i18n.value);

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

  const switchSheet = (sheet: DictionarySheet) => {
    if (sheet === session.sheet) return;

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

  const handleSelectionChange = (selection: GridSelection) => {
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

  const handleCommit = (event: CommitEvent) => {
    const { sheet, rows } = session;
    if (!isEntrySheet(sheet)) return;

    commitDictionaryCells(app.value, sheet, rows, event, i18n.value);
  };

  const handleSearch = (event: InputEvent) => {
    const { sheet } = session;
    changeSearch(view, sheet, (event.target as HTMLInputElement).value);
    refresh(storedSelection(view, sheet, state.rowCount, columns.length));
    session.handle.scrollTo(0, 0);
  };

  const handleAddRow = () => {
    const { sheet } = session;
    if (!isEntrySheet(sheet)) return;

    // A row starts with no name, which no search finds, so the search goes.
    if (view.sheets[sheet].search) {
      changeSearch(view, sheet, '');
      refresh(storedSelection(view, sheet, state.rowCount, columns.length));
    }
    pending = 'add';
    app.value.store.dispatch(addDictionaryEntryAction$(sheet));
    session.handle.focus();
  };

  const handleDeleteRows = () => {
    const { sheet, rows, selection } = session;
    if (!isEntrySheet(sheet)) return;

    if (removeSelectedRows(app.value.store, sheet, rows, selection)) {
      pending = 'remove';
    }
    session.handle.focus();
  };

  /** Where the active cell goes once a row button's batch lands: on the added row, last of all, or where the removed rows began. */
  const selectionAfter = (asked: Pending): GridSelection | undefined => {
    const { sheet, selection } = session;
    if (!asked || !isEntrySheet(sheet)) return;

    const ids = sheetRowIds(
      app.value.store.state,
      sheet,
      view.sheets[sheet].search
    );
    if (!ids.length) return;

    if (asked === 'add') {
      revealRow = ids.length - 1;
      return cellSelection(revealRow, 0);
    }
    return cellSelection(
      Math.min(topRow(selection), ids.length - 1),
      selection.active.col
    );
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const { keyBindingMap, store } = app.value;

    handleDictionaryKeydown(event, {
      keyBindingMap,
      store,
      inGrid: event.composedPath().includes(sheetRef.value as EventTarget),
      isEditing: () => session.handle.isEditing(),
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
        if (!bumpedSheets(actions).includes(session.sheet)) return;

        const asked = pending;
        pending = null;
        refresh(selectionAfter(asked));
      })
    );
  });

  // The grid takes a new row count a tick after the render that hands it
  // over, so the added row is scrolled to once that tick has run.
  onUpdated(() => {
    const row = revealRow;
    if (row === null) return;

    revealRow = null;
    nextTick(() => session.handle.scrollTo(row, 0));
  });

  return () => {
    const i18nValue = i18n.value;
    const { t } = i18nValue;
    const { sheet } = session;
    const entry = isEntrySheet(sheet);
    const { version, rowCount, selectedRows, empty } = state;
    const gridColumns = columnsOf(sheet, i18nValue);

    gridTheme = toGridTheme(theme.value, gridTheme);
    session.rows.receive(version);

    return (
      <div
        class={['dictionary', styles.root]}
        on:keydown={handleKeydown}
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
                {t(DictionarySheetLabelKey[item])}
              </button>
            ))}
          </div>
          <TextInput
            class={styles.search}
            title={t('common.search')}
            placeholder={t('common.search')}
            dir="auto"
            value={view.sheets[sheet].search}
            onInput={handleSearch}
          />
          {entry && !props.readonly ? (
            <div class={styles.actions}>
              <Button
                size="1"
                variant="soft"
                text={t('dictionary.addRow')}
                onClick={handleAddRow}
              />
              <Button
                size="1"
                variant="soft"
                text={t('dictionary.deleteRows')}
                onClick={handleDeleteRows}
              />
            </div>
          ) : null}
        </div>
        <div class={styles.sheet} use:ref={ref(sheetRef)}>
          {repeat(
            [sheet],
            key => key,
            () => (
              <Grid
                rowCount={rowCount}
                columns={gridColumns}
                getCell={getCell}
                theme={gridTheme}
                version={version}
                ariaLabel={t(DictionarySheetLabelKey[sheet])}
                onCommit={handleCommit}
                onSelectionChange={handleSelectionChange}
                onViewportChange={handleViewportChange}
                onColumnResize={handleColumnResize}
                onReady={handleReady}
              />
            )
          )}
          {empty && !props.readonly ? (
            <p class={styles.empty}>{t('dictionary.empty', { format: CSV })}</p>
          ) : null}
        </div>
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
