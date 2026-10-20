import type { CellRange, GridHandle, GridSelection } from '@dineug/grid';
import { observable } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import {
  DictionarySheet,
  DictionarySheetList,
} from '@/components/dictionary/sheets';
import type { RxStore } from '@/engine/rx-store';

/** The first cell a sheet showed, the one a grid mounted again scrolls back to. */
export type SheetScroll = { row: number; col: number };

/**
 * What the tab keeps of one sheet across its mounts. The selection and the
 * scroll count rows of the sheet as its search shows them. Each is frozen and
 * replaced whole, so a watcher hears one change and a grid is handed no proxy.
 */
export type DictionarySheetView = {
  search: string;
  selection: Readonly<GridSelection> | null;
  scroll: Readonly<SheetScroll> | null;
  /** The widths a resize left, by column id. */
  widths: Readonly<Record<string, number>>;
};

export type DictionaryView = {
  sheet: DictionarySheet;
  sheets: Record<DictionarySheet, DictionarySheetView>;
};

const views = new WeakMap<RxStore, DictionaryView>();

const createSheetView = (): DictionarySheetView => ({
  search: '',
  selection: null,
  scroll: null,
  widths: Object.freeze({}),
});

/**
 * The window's own place in the Dictionary tab: never in the store, the file
 * or a change event, kept until the element goes, one per editor. The tab
 * mounts again on every visit and reads it back.
 */
export function dictionaryViewOf({
  store,
}: Pick<AppContext, 'store'>): DictionaryView {
  let view = views.get(store);

  if (!view) {
    view = observable<DictionaryView>({
      sheet: DictionarySheet.word,
      sheets: Object.fromEntries(
        DictionarySheetList.map(sheet => [sheet, createSheetView()])
      ) as Record<DictionarySheet, DictionarySheetView>,
    });
    views.set(store, view);
  }

  return view;
}

/**
 * Writes a sheet's search. The rows it shows change with it, so the selection
 * and the scroll it kept, which count those rows, are dropped.
 */
export function changeSearch(
  view: DictionaryView,
  sheet: DictionarySheet,
  search: string
) {
  const sheetView = view.sheets[sheet];
  if (sheetView.search === search) return;

  sheetView.search = search;
  sheetView.selection = null;
  sheetView.scroll = null;
}

const copyRange = (range: CellRange): CellRange => ({
  startRow: range.startRow,
  startCol: range.startCol,
  endRow: range.endRow,
  endCol: range.endCol,
});

/** Keeps the selection a grid reported or was handed, as a frozen copy. */
export function rememberSelection(
  view: DictionaryView,
  sheet: DictionarySheet,
  selection: GridSelection
) {
  view.sheets[sheet].selection = Object.freeze({
    active: Object.freeze({ ...selection.active }),
    ranges: Object.freeze(
      selection.ranges.map(range => Object.freeze(copyRange(range)))
    ) as CellRange[],
  });
}

/**
 * A selection held inside the rows and columns a grid has, every index cut to
 * the last one and a range kept start before end; a grid with no rows keeps
 * its first cell, where a row added comes up active.
 */
export function clampSelection(
  selection: Readonly<GridSelection>,
  rowCount: number,
  colCount: number
): GridSelection {
  const toRow = (row: number) =>
    Math.min(Math.max(row, 0), Math.max(rowCount - 1, 0));
  const toCol = (col: number) =>
    Math.min(Math.max(col, 0), Math.max(colCount - 1, 0));

  return {
    active: {
      row: toRow(selection.active.row),
      col: toCol(selection.active.col),
    },
    ranges: selection.ranges.map(range => {
      const [startRow, endRow] = [toRow(range.startRow), toRow(range.endRow)];
      const [startCol, endCol] = [toCol(range.startCol), toCol(range.endCol)];
      return {
        startRow: Math.min(startRow, endRow),
        startCol: Math.min(startCol, endCol),
        endRow: Math.max(startRow, endRow),
        endCol: Math.max(startCol, endCol),
      };
    }),
  };
}

/** The first cell alone, what a sheet opens on before it has a selection of its own. */
export const FIRST_CELL_SELECTION: Readonly<GridSelection> = Object.freeze({
  active: Object.freeze({ row: 0, col: 0 }),
  ranges: Object.freeze([
    Object.freeze({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 }),
  ]) as CellRange[],
});

/**
 * The selection a grid mounted on the sheet is handed: the one it kept, held
 * inside the rows it shows now, or the first cell. A fresh copy, since a grid
 * holds what it is handed.
 */
export function storedSelection(
  view: DictionaryView,
  sheet: DictionarySheet,
  rowCount: number,
  colCount: number
): GridSelection {
  return clampSelection(
    view.sheets[sheet].selection ?? FIRST_CELL_SELECTION,
    rowCount,
    colCount
  );
}

/** Keeps the first cell a grid showed, from its viewport report, when it moved. */
export function rememberScroll(
  view: DictionaryView,
  sheet: DictionarySheet,
  { rowStart, colStart }: { rowStart: number; colStart: number }
) {
  const sheetView = view.sheets[sheet];
  const kept = sheetView.scroll;
  if (kept && kept.row === rowStart && kept.col === colStart) return;

  sheetView.scroll = Object.freeze({ row: rowStart, col: colStart });
}

/**
 * Scrolls a grid back to the first cell its sheet showed. A grid scrolls the
 * least distance that shows a cell, so it goes to the last cell first, and the
 * way back up then stops with the kept cell first in view.
 */
export function restoreScroll(
  handle: Pick<GridHandle, 'scrollTo'>,
  view: DictionaryView,
  sheet: DictionarySheet,
  rowCount: number,
  colCount: number
) {
  const { scroll } = view.sheets[sheet];
  if (!scroll || rowCount <= 0 || colCount <= 0) return;

  handle.scrollTo(rowCount - 1, colCount - 1);
  handle.scrollTo(
    Math.min(scroll.row, rowCount - 1),
    Math.min(scroll.col, colCount - 1)
  );
}

/** Keeps the width a resize left a column at, which the grid draws only while the host holds it. */
export function rememberWidth(
  view: DictionaryView,
  sheet: DictionarySheet,
  columnId: string,
  width: number
) {
  const sheetView = view.sheets[sheet];
  if (sheetView.widths[columnId] === width) return;

  sheetView.widths = Object.freeze({ ...sheetView.widths, [columnId]: width });
}
