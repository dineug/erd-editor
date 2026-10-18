import type {
  CellRange,
  CellRef,
  GridBounds,
  GridSelection,
} from '@/model/types';

/** The modifiers a selection gesture reads; ctrl is Cmd on an Apple platform and Ctrl elsewhere. */
export interface SelectModifiers {
  shift?: boolean;
  ctrl?: boolean;
}

/**
 * A key moveActive understands: the arrows, Home, End, PageUp, PageDown, Tab
 * and Enter by their KeyboardEvent names, and SelectAll for Ctrl or Cmd with A.
 */
export type NavigationKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  | 'Tab'
  | 'Enter'
  | 'SelectAll';

/** An inclusive run of row or column indexes, start <= end. */
export interface IndexSpan {
  start: number;
  end: number;
}

/**
 * The rows or the columns a header paints as selected, sorted and merged:
 * intersected holds every index a range in the grid reaches, covered only the
 * ones a range spans from the first cell to the last across the other axis.
 */
export interface HeaderSelection {
  intersected: IndexSpan[];
  covered: IndexSpan[];
}

/** How one header cell paints, by what the ranges do to its row or column. */
export type HeaderState = 'none' | 'intersected' | 'covered';

/** The rectangle two cells span, whichever corner each one is. */
export const spanOf = (a: CellRef, b: CellRef): CellRange => ({
  startRow: Math.min(a.row, b.row),
  startCol: Math.min(a.col, b.col),
  endRow: Math.max(a.row, b.row),
  endCol: Math.max(a.col, b.col),
});

/** One cell selected alone, the state a plain click or a plain arrow leaves. */
export const selectCell = (cell: CellRef): GridSelection => ({
  active: { row: cell.row, col: cell.col },
  ranges: [spanOf(cell, cell)],
});

const sameRange = (a: CellRange, b: CellRange) =>
  a.startRow === b.startRow &&
  a.startCol === b.startCol &&
  a.endRow === b.endRow &&
  a.endCol === b.endCol;

/** Whether two selections hold the same active cell and the same ranges in the same order. */
export function selectionEquals(a: GridSelection, b: GridSelection): boolean {
  if (a === b) {
    return true;
  }

  if (
    a.active.row !== b.active.row ||
    a.active.col !== b.active.col ||
    a.ranges.length !== b.ranges.length
  ) {
    return false;
  }

  return a.ranges.every((range, index) => sameRange(range, b.ranges[index]));
}

/**
 * The previous selection itself when the next one holds the same cells, so a
 * caller tells a change by identity and reports each change exactly once.
 */
const settle = (prev: GridSelection, next: GridSelection) =>
  selectionEquals(prev, next) ? prev : next;

const isEmpty = (bounds: GridBounds) =>
  bounds.rowCount < 1 || bounds.colCount < 1;

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

const clampCell = (cell: CellRef, bounds: GridBounds): CellRef => ({
  row: clamp(cell.row, bounds.rowCount - 1),
  col: clamp(cell.col, bounds.colCount - 1),
});

/** The range Shift extends: the last one, or the active cell alone when a host handed no range. */
const lastRange = (sel: GridSelection): CellRange =>
  sel.ranges.length > 0
    ? sel.ranges[sel.ranges.length - 1]
    : spanOf(sel.active, sel.active);

const replaceLast = (ranges: CellRange[], range: CellRange) => [
  ...ranges.slice(0, -1),
  range,
];

/** The end of a span farther from the anchor, the end itself on a tie. */
const farEnd = (anchor: number, start: number, end: number) =>
  anchor - start > end - anchor ? start : end;

/**
 * The corner of the last range across from the active cell, the one Shift
 * moves. An active cell inside the range, as select-all leaves it, takes the
 * farther end of each axis.
 */
function focusOf(sel: GridSelection): CellRef {
  const range = lastRange(sel);

  return {
    row: farEnd(sel.active.row, range.startRow, range.endRow),
    col: farEnd(sel.active.col, range.startCol, range.endCol),
  };
}

/**
 * The rule every pointer gesture shares, as a spreadsheet has it. Shift swaps
 * the last range for the extended one and keeps the active cell, Ctrl adds the
 * range, and no modifier makes that range the only one.
 */
function place(
  sel: GridSelection,
  mods: SelectModifiers,
  active: CellRef,
  range: CellRange,
  extended: CellRange
): GridSelection {
  if (mods.shift) {
    return settle(sel, {
      active: sel.active,
      ranges: replaceLast(sel.ranges, extended),
    });
  }

  if (mods.ctrl) {
    return { active, ranges: [...sel.ranges, range] };
  }

  return settle(sel, { active, ranges: [range] });
}

/** A click on a cell; Ctrl on a cell already selected adds it again and deselects nothing. */
export const clickCell = (
  sel: GridSelection,
  cell: CellRef,
  mods: SelectModifiers = {}
): GridSelection =>
  place(
    sel,
    mods,
    { row: cell.row, col: cell.col },
    spanOf(cell, cell),
    spanOf(sel.active, cell)
  );

/**
 * The pointer moving over a cell while a press holds: the last range runs from
 * the active cell to it, whichever modifier began the press.
 */
export const dragTo = (sel: GridSelection, cell: CellRef): GridSelection =>
  clickCell(sel, cell, { shift: true });

const columnSpan = (from: number, to: number, bounds: GridBounds) => ({
  startRow: 0,
  startCol: Math.min(from, to),
  endRow: bounds.rowCount - 1,
  endCol: Math.max(from, to),
});

const rowSpan = (from: number, to: number, bounds: GridBounds) => ({
  startRow: Math.min(from, to),
  startCol: 0,
  endRow: Math.max(from, to),
  endCol: bounds.colCount - 1,
});

/**
 * A click on a column header selects the column with its top cell active.
 * Shift runs the columns from the active cell's, which a header drag calls
 * on each column it crosses.
 */
export function clickColumnHeader(
  sel: GridSelection,
  col: number,
  mods: SelectModifiers,
  bounds: GridBounds
): GridSelection {
  if (isEmpty(bounds)) {
    return sel;
  }

  const target = clamp(col, bounds.colCount - 1);

  return place(
    sel,
    mods,
    { row: 0, col: target },
    columnSpan(target, target, bounds),
    columnSpan(sel.active.col, target, bounds)
  );
}

/** A click on a row number selects the row with its first cell active, the column rule turned. */
export function clickRowHeader(
  sel: GridSelection,
  row: number,
  mods: SelectModifiers,
  bounds: GridBounds
): GridSelection {
  if (isEmpty(bounds)) {
    return sel;
  }

  const target = clamp(row, bounds.rowCount - 1);

  return place(
    sel,
    mods,
    { row: target, col: 0 },
    rowSpan(target, target, bounds),
    rowSpan(sel.active.row, target, bounds)
  );
}

/**
 * A click on the corner selects every cell as one range, so a million rows
 * cost one rectangle. The active cell stays where it was, as select-all keeps
 * it in a spreadsheet.
 */
export function clickCorner(
  sel: GridSelection,
  mods: SelectModifiers,
  bounds: GridBounds
): GridSelection {
  if (isEmpty(bounds)) {
    return sel;
  }

  const every = rowSpan(0, bounds.rowCount - 1, bounds);

  return place(sel, mods, clampCell(sel.active, bounds), every, every);
}

/** Ctrl or Cmd with A: the corner click with no modifier. */
export const selectAll = (
  sel: GridSelection,
  bounds: GridBounds
): GridSelection => clickCorner(sel, {}, bounds);

/** Where a key takes one cell, clamped to the grid; toEdge is Ctrl or Cmd held. */
function step(
  cell: CellRef,
  key: Exclude<NavigationKey, 'Tab' | 'Enter' | 'SelectAll'>,
  toEdge: boolean,
  bounds: GridBounds,
  pageRows: number
): CellRef {
  const lastRow = bounds.rowCount - 1;
  const lastCol = bounds.colCount - 1;
  const { row, col } = cell;
  const page = Math.max(1, Math.floor(pageRows));

  switch (key) {
    case 'ArrowUp':
      return clampCell({ row: toEdge ? 0 : row - 1, col }, bounds);
    case 'ArrowDown':
      return clampCell({ row: toEdge ? lastRow : row + 1, col }, bounds);
    case 'ArrowLeft':
      return clampCell({ row, col: toEdge ? 0 : col - 1 }, bounds);
    case 'ArrowRight':
      return clampCell({ row, col: toEdge ? lastCol : col + 1 }, bounds);
    case 'Home':
      return toEdge ? { row: 0, col: 0 } : clampCell({ row, col: 0 }, bounds);
    case 'End':
      return toEdge
        ? { row: lastRow, col: lastCol }
        : clampCell({ row, col: lastCol }, bounds);
    case 'PageUp':
      return clampCell({ row: row - page, col }, bounds);
    case 'PageDown':
      return clampCell({ row: row + page, col }, bounds);
  }
}

/**
 * A navigation key, as a spreadsheet moves: alone, the selection becomes the
 * cell it lands on, and Shift moves the far corner of the last range. Tab stops
 * at either end of its row and Enter of its column, and Shift turns both back.
 */
export function moveActive(
  sel: GridSelection,
  key: NavigationKey,
  mods: SelectModifiers,
  bounds: GridBounds,
  pageRows: number
): GridSelection {
  if (isEmpty(bounds)) {
    return sel;
  }

  if (key === 'SelectAll') {
    return selectAll(sel, bounds);
  }

  if (key === 'Tab' || key === 'Enter') {
    const { row, col } = clampCell(sel.active, bounds);
    const delta = mods.shift ? -1 : 1;
    const target =
      key === 'Tab' ? { row, col: col + delta } : { row: row + delta, col };

    return settle(sel, selectCell(clampCell(target, bounds)));
  }

  const toEdge = Boolean(mods.ctrl);

  if (mods.shift) {
    const anchor = clampCell(sel.active, bounds);
    const focus = step(
      clampCell(focusOf(sel), bounds),
      key,
      toEdge,
      bounds,
      pageRows
    );

    return settle(sel, {
      active: anchor,
      ranges: replaceLast(sel.ranges, spanOf(anchor, focus)),
    });
  }

  return settle(
    sel,
    selectCell(
      step(clampCell(sel.active, bounds), key, toEdge, bounds, pageRows)
    )
  );
}

const contains = (range: CellRange, cell: CellRef) =>
  cell.row >= range.startRow &&
  cell.row <= range.endRow &&
  cell.col >= range.startCol &&
  cell.col <= range.endCol;

/** Whether any range holds the cell, the test a right click makes before it moves the active cell. */
export const isSelected = (sel: GridSelection, cell: CellRef): boolean =>
  sel.ranges.some(range => contains(range, cell));

/** Spans sorted by start, with the ones that overlap or touch joined. */
function mergeSpans(spans: IndexSpan[]): IndexSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: IndexSpan[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];

    if (last && span.start <= last.end + 1) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ start: span.start, end: span.end });
    }
  }

  return merged;
}

/**
 * Whether a range holds a cell of the grid. One that starts past the last row
 * or column, as a default selection on an empty grid or one left behind by
 * fewer rows does, lights no header, as the overlay draws no box for it.
 */
const holdsCell = (range: CellRange, bounds: GridBounds) =>
  range.startRow < bounds.rowCount && range.startCol < bounds.colCount;

/**
 * The ranges held to the grid's last row and column, any that holds none of
 * its cells dropped, so a clear or a copy after the host took rows or columns
 * away reaches only the cells the grid still has.
 */
export function rangesInGrid(
  ranges: readonly CellRange[],
  bounds: GridBounds
): CellRange[] {
  const held: CellRange[] = [];

  for (const range of ranges) {
    if (!holdsCell(range, bounds)) continue;

    held.push({
      ...range,
      endRow: Math.min(range.endRow, bounds.rowCount - 1),
      endCol: Math.min(range.endCol, bounds.colCount - 1),
    });
  }

  return held;
}

/** The rows the row number header paints; a row is covered when a range spans every column. */
export function selectedRows(
  sel: GridSelection,
  bounds: GridBounds
): HeaderSelection {
  const intersected: IndexSpan[] = [];
  const covered: IndexSpan[] = [];

  for (const range of sel.ranges) {
    if (!holdsCell(range, bounds)) continue;

    const span = { start: range.startRow, end: range.endRow };

    intersected.push(span);

    if (range.startCol <= 0 && range.endCol >= bounds.colCount - 1) {
      covered.push(span);
    }
  }

  return { intersected: mergeSpans(intersected), covered: mergeSpans(covered) };
}

/** The columns the column header paints; a column is covered when a range spans every row. */
export function selectedColumns(
  sel: GridSelection,
  bounds: GridBounds
): HeaderSelection {
  const intersected: IndexSpan[] = [];
  const covered: IndexSpan[] = [];

  for (const range of sel.ranges) {
    if (!holdsCell(range, bounds)) continue;

    const span = { start: range.startCol, end: range.endCol };

    intersected.push(span);

    if (range.startRow <= 0 && range.endRow >= bounds.rowCount - 1) {
      covered.push(span);
    }
  }

  return { intersected: mergeSpans(intersected), covered: mergeSpans(covered) };
}

/** Whether a sorted, merged list holds the index; it stops at the first span past it. */
function inSpans(spans: IndexSpan[], index: number): boolean {
  for (const span of spans) {
    if (index < span.start) {
      return false;
    }

    if (index <= span.end) {
      return true;
    }
  }

  return false;
}

/** How the header of one row or column paints, read off selectedRows or selectedColumns. */
export const headerState = (
  header: HeaderSelection,
  index: number
): HeaderState =>
  inSpans(header.covered, index)
    ? 'covered'
    : inSpans(header.intersected, index)
      ? 'intersected'
      : 'none';
