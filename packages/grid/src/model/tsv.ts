import type { CellRange, GridSelection } from '@/model/types';

/** One value bound for one cell, by its row and column indexes. */
export interface CellWrite {
  row: number;
  col: number;
  value: string;
}

/** A run of row or column indexes, inclusive on both ends, with start <= end. */
export interface IndexSpan {
  start: number;
  end: number;
}

/**
 * The cells a copy reads: every row of rows against every column of cols,
 * both lists sorted and disjoint, so the text keeps sheet order and names a
 * cell two ranges share once.
 */
export interface CopyArea {
  rows: IndexSpan[];
  cols: IndexSpan[];
}

/** What would split a value into two cells or two rows once it is pasted back. */
const CELL_BREAK = /[\t\n\r]/g;

const LINE_BREAK = /\r?\n/;

/**
 * Tab-separated text, one line per row with no newline after the last and no
 * quoting. A tab or line break inside a value turns into a space, the way the
 * cell draws it, so a paste of the text lands in the shape it was copied from.
 */
export function serialize(rows: readonly (readonly string[])[]): string {
  return rows
    .map(row => row.map(value => value.replace(CELL_BREAK, ' ')).join('\t'))
    .join('\n');
}

/**
 * Rows of cell values out of clipboard text: CRLF and LF end a row, a tab ends
 * a cell, a quote is text like any other, and the empty lines at the end, such
 * as the newline a spreadsheet writes after its last row, are dropped.
 */
export function parse(text: string): string[][] {
  const lines = text.split(LINE_BREAK);
  let end = lines.length;

  while (end > 0 && lines[end - 1] === '') {
    end--;
  }

  return lines.slice(0, end).map(line => line.split('\t'));
}

/** Sorted spans with every overlapping or touching pair joined into one. */
function mergeSpans(spans: IndexSpan[]): IndexSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: IndexSpan[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];

    if (last && span.start <= last.end + 1) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }

  return merged;
}

const rowSpan = (range: CellRange): IndexSpan => ({
  start: range.startRow,
  end: range.endRow,
});

const colSpan = (range: CellRange): IndexSpan => ({
  start: range.startCol,
  end: range.endCol,
});

const sameSpan = (a: IndexSpan, b: IndexSpan) =>
  a.start === b.start && a.end === b.end;

/**
 * The cells a copy of these ranges reads, or null where a spreadsheet refuses
 * to copy them: several ranges copy only when they cover the same rows, side
 * by side, or the same columns, stacked, and the caller then reports a reject.
 */
export function copyableRanges(ranges: readonly CellRange[]): CopyArea | null {
  if (ranges.length === 0) return { rows: [], cols: [] };

  const rows = ranges.map(rowSpan);
  const cols = ranges.map(colSpan);

  if (rows.every(span => sameSpan(span, rows[0]))) {
    return { rows: [rows[0]], cols: mergeSpans(cols) };
  }

  if (cols.every(span => sameSpan(span, cols[0]))) {
    return { rows: mergeSpans(rows), cols: [cols[0]] };
  }

  return null;
}

/** The values a copy writes, row by row in sheet order, read from the host's getter. */
export function copyRows(
  area: CopyArea,
  getCell: (row: number, col: number) => string
): string[][] {
  const rows: string[][] = [];

  for (const rowRun of area.rows) {
    for (let row = rowRun.start; row <= rowRun.end; row++) {
      const values: string[] = [];

      for (const colRun of area.cols) {
        for (let col = colRun.start; col <= colRun.end; col++) {
          values.push(getCell(row, col));
        }
      }

      rows.push(values);
    }
  }

  return rows;
}

const covers = (range: CellRange, row: number, col: number) =>
  row >= range.startRow &&
  row <= range.endRow &&
  col >= range.startCol &&
  col <= range.endCol;

/**
 * One value for every cell of every range, range by range and row by row,
 * naming a cell two ranges share once. A one-cell paste fills the selection
 * this way, and a clear is the same fill with an empty value.
 */
export function fillTargets(
  ranges: readonly CellRange[],
  value: string
): CellWrite[] {
  const writes: CellWrite[] = [];

  ranges.forEach((range, index) => {
    const earlier = ranges.slice(0, index);

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        if (!earlier.some(other => covers(other, row, col))) {
          writes.push({ row, col, value });
        }
      }
    }
  });

  return writes;
}

/**
 * Where pasted rows land. A clipboard of one cell fills every range, and any
 * other is written once from the active cell, past the last row too, whose
 * rows the host may add; the caller drops columns past the last one.
 */
export function pasteTargets(
  selection: GridSelection,
  matrix: readonly (readonly string[])[]
): CellWrite[] {
  if (matrix.length === 1 && matrix[0].length === 1) {
    return fillTargets(selection.ranges, matrix[0][0]);
  }

  const { row: top, col: left } = selection.active;
  const writes: CellWrite[] = [];

  matrix.forEach((values, rowOffset) => {
    values.forEach((value, colOffset) => {
      writes.push({ row: top + rowOffset, col: left + colOffset, value });
    });
  });

  return writes;
}
