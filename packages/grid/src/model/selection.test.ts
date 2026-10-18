import { describe, expect, it } from 'vite-plus/test';

import {
  clickCell,
  clickColumnHeader,
  clickCorner,
  clickRowHeader,
  dragTo,
  headerState,
  isSelected,
  moveActive,
  rangesInGrid,
  selectAll,
  selectCell,
  selectedColumns,
  selectedRows,
  selectionEquals,
  spanOf,
} from '@/model/selection';
import type { CellRange, GridBounds, GridSelection } from '@/model/types';

const range = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): CellRange => ({ startRow, startCol, endRow, endCol });

const selection = (
  row: number,
  col: number,
  ...ranges: CellRange[]
): GridSelection => ({ active: { row, col }, ranges });

const BOUNDS: GridBounds = { rowCount: 100, colCount: 10 };

const MILLION: GridBounds = { rowCount: 1_000_000, colCount: 30 };

const EMPTY: GridBounds = { rowCount: 0, colCount: 10 };

describe('the span two cells make', () => {
  it('normalizes to start <= end on both axes, whichever corner comes first', () => {
    expect(spanOf({ row: 5, col: 1 }, { row: 2, col: 4 })).toEqual(
      range(2, 1, 5, 4)
    );
    expect(selectCell({ row: 3, col: 7 })).toEqual(
      selection(3, 7, range(3, 7, 3, 7))
    );
  });

  it('compares the active cell, the range count and every range in order', () => {
    const base = selection(1, 1, range(1, 1, 2, 2), range(4, 4, 4, 4));

    expect(selectionEquals(base, base)).toBe(true);
    expect(selectionEquals(base, structuredClone(base))).toBe(true);
    expect(selectionEquals(base, { ...base, active: { row: 1, col: 2 } })).toBe(
      false
    );
    expect(selectionEquals(base, { ...base, ranges: [base.ranges[0]] })).toBe(
      false
    );
    expect(
      selectionEquals(base, {
        ...base,
        ranges: [base.ranges[1], base.ranges[0]],
      })
    ).toBe(false);
  });
});

describe('a click on a cell', () => {
  const multi = selection(4, 4, range(0, 0, 1, 1), range(4, 4, 6, 6));

  it('drops every range for the one cell when no modifier is held', () => {
    expect(clickCell(multi, { row: 9, col: 2 })).toEqual(
      selection(9, 2, range(9, 2, 9, 2))
    );
  });

  it('hands back the same selection when the click changes nothing', () => {
    const single = selectCell({ row: 3, col: 3 });

    expect(clickCell(single, { row: 3, col: 3 })).toBe(single);
    expect(clickCell(single, { row: 3, col: 3 }, { shift: true })).toBe(single);
  });

  it('extends the last range from the active cell under Shift, keeping the rest', () => {
    const next = clickCell(multi, { row: 2, col: 8 }, { shift: true });

    expect(next).toEqual(selection(4, 4, range(0, 0, 1, 1), range(2, 4, 4, 8)));
    expect(next.active).toBe(multi.active);
  });

  it('adds a range under Ctrl and moves the active cell to it', () => {
    expect(clickCell(multi, { row: 9, col: 9 }, { ctrl: true })).toEqual(
      selection(9, 9, range(0, 0, 1, 1), range(4, 4, 6, 6), range(9, 9, 9, 9))
    );
  });

  it('adds a selected cell again under Ctrl rather than deselect it', () => {
    const next = clickCell(multi, { row: 5, col: 5 }, { ctrl: true });

    expect(next.ranges).toHaveLength(3);
    expect(next.ranges[2]).toEqual(range(5, 5, 5, 5));
    expect(isSelected(next, { row: 5, col: 5 })).toBe(true);
  });

  it('reads Shift before Ctrl when both are held', () => {
    expect(
      clickCell(multi, { row: 8, col: 8 }, { shift: true, ctrl: true })
    ).toEqual(selection(4, 4, range(0, 0, 1, 1), range(4, 4, 8, 8)));
  });

  it('extends from a host selection that carries no range', () => {
    expect(
      clickCell(selection(2, 2), { row: 3, col: 3 }, { shift: true })
    ).toEqual(selection(2, 2, range(2, 2, 3, 3)));
  });
});

describe('a drag across cells', () => {
  it('runs the last range from the active cell to the pointer, either way', () => {
    const pressed = clickCell(selectCell({ row: 0, col: 0 }), {
      row: 5,
      col: 5,
    });

    expect(dragTo(pressed, { row: 7, col: 8 })).toEqual(
      selection(5, 5, range(5, 5, 7, 8))
    );
    expect(dragTo(pressed, { row: 2, col: 1 })).toEqual(
      selection(5, 5, range(2, 1, 5, 5))
    );
  });

  it('grows only the range a Ctrl press added', () => {
    const pressed = clickCell(
      selectCell({ row: 0, col: 0 }),
      { row: 5, col: 5 },
      { ctrl: true }
    );

    expect(dragTo(pressed, { row: 6, col: 6 })).toEqual(
      selection(5, 5, range(0, 0, 0, 0), range(5, 5, 6, 6))
    );
  });
});

describe('a click on a header', () => {
  const start = selectCell({ row: 7, col: 2 });

  it('selects the whole column with its top cell active', () => {
    expect(clickColumnHeader(start, 4, {}, BOUNDS)).toEqual(
      selection(0, 4, range(0, 4, 99, 4))
    );
  });

  it('runs the columns from the active cell under Shift and adds one under Ctrl', () => {
    expect(clickColumnHeader(start, 5, { shift: true }, BOUNDS)).toEqual(
      selection(7, 2, range(0, 2, 99, 5))
    );
    expect(clickColumnHeader(start, 0, { shift: true }, BOUNDS)).toEqual(
      selection(7, 2, range(0, 0, 99, 2))
    );
    expect(clickColumnHeader(start, 5, { ctrl: true }, BOUNDS)).toEqual(
      selection(0, 5, range(7, 2, 7, 2), range(0, 5, 99, 5))
    );
  });

  it('extends a header drag through every column it crosses', () => {
    const pressed = clickColumnHeader(start, 3, {}, BOUNDS);
    const dragged = clickColumnHeader(pressed, 6, { shift: true }, BOUNDS);

    expect(dragged).toEqual(selection(0, 3, range(0, 3, 99, 6)));
  });

  it('selects the whole row with its first cell active, by the same rule', () => {
    expect(clickRowHeader(start, 40, {}, BOUNDS)).toEqual(
      selection(40, 0, range(40, 0, 40, 9))
    );
    expect(clickRowHeader(start, 3, { shift: true }, BOUNDS)).toEqual(
      selection(7, 2, range(3, 0, 7, 9))
    );
    expect(clickRowHeader(start, 9, { ctrl: true }, BOUNDS)).toEqual(
      selection(9, 0, range(7, 2, 7, 2), range(9, 0, 9, 9))
    );
  });

  it('clamps an index past the last row or column', () => {
    expect(clickColumnHeader(start, 50, {}, BOUNDS).active).toEqual({
      row: 0,
      col: 9,
    });
    expect(clickRowHeader(start, 500, {}, BOUNDS).active).toEqual({
      row: 99,
      col: 0,
    });
  });

  it('selects every cell from the corner as one range and keeps the active cell', () => {
    const every = clickCorner(start, {}, MILLION);

    expect(every).toEqual(selection(7, 2, range(0, 0, 999_999, 29)));
    expect(clickCorner(every, {}, MILLION)).toBe(every);
  });

  it('adds the whole grid from the corner under Ctrl and swaps the last range under Shift', () => {
    const multi = selection(7, 2, range(0, 0, 0, 0), range(7, 2, 7, 2));

    expect(clickCorner(multi, { ctrl: true }, BOUNDS).ranges).toEqual([
      range(0, 0, 0, 0),
      range(7, 2, 7, 2),
      range(0, 0, 99, 9),
    ]);
    expect(clickCorner(multi, { shift: true }, BOUNDS).ranges).toEqual([
      range(0, 0, 0, 0),
      range(0, 0, 99, 9),
    ]);
  });

  it('changes nothing on a grid with no rows or no columns', () => {
    expect(clickColumnHeader(start, 1, {}, EMPTY)).toBe(start);
    expect(clickRowHeader(start, 1, {}, EMPTY)).toBe(start);
    expect(clickCorner(start, {}, { rowCount: 5, colCount: 0 })).toBe(start);
  });
});

describe('a navigation key', () => {
  const at = (row: number, col: number) => selectCell({ row, col });
  const move = (
    sel: GridSelection,
    key: Parameters<typeof moveActive>[1],
    mods: Parameters<typeof moveActive>[2] = {},
    pageRows = 10
  ) => moveActive(sel, key, mods, BOUNDS, pageRows);

  it('moves one cell with each arrow and drops every range', () => {
    const multi = selection(5, 5, range(0, 0, 9, 9), range(5, 5, 6, 6));

    expect(move(multi, 'ArrowDown')).toEqual(at(6, 5));
    expect(move(multi, 'ArrowUp')).toEqual(at(4, 5));
    expect(move(multi, 'ArrowLeft')).toEqual(at(5, 4));
    expect(move(multi, 'ArrowRight')).toEqual(at(5, 6));
  });

  it('stops at the grid edge and hands back the same selection there', () => {
    const corner = at(0, 0);
    const far = at(99, 9);

    expect(move(corner, 'ArrowUp')).toBe(corner);
    expect(move(corner, 'ArrowLeft')).toBe(corner);
    expect(move(far, 'ArrowDown')).toBe(far);
    expect(move(far, 'ArrowRight')).toBe(far);
  });

  it('jumps to the grid edge under Ctrl, never scanning for a data edge', () => {
    expect(move(at(50, 5), 'ArrowDown', { ctrl: true })).toEqual(at(99, 5));
    expect(move(at(50, 5), 'ArrowUp', { ctrl: true })).toEqual(at(0, 5));
    expect(move(at(50, 5), 'ArrowLeft', { ctrl: true })).toEqual(at(50, 0));
    expect(move(at(50, 5), 'ArrowRight', { ctrl: true })).toEqual(at(50, 9));
  });

  it('extends the last range under Shift by its corner across from the active cell', () => {
    const grown = move(
      move(at(5, 5), 'ArrowDown', { shift: true }),
      'ArrowRight',
      {
        shift: true,
      }
    );

    expect(grown).toEqual(selection(5, 5, range(5, 5, 6, 6)));
    expect(move(grown, 'ArrowUp', { shift: true })).toEqual(
      selection(5, 5, range(5, 5, 5, 6))
    );
  });

  it('flips the range past the active cell when Shift keeps going', () => {
    const above = move(
      move(at(5, 5), 'ArrowDown', { shift: true }),
      'ArrowUp',
      { shift: true }
    );

    expect(above).toEqual(at(5, 5));
    expect(move(above, 'ArrowUp', { shift: true })).toEqual(
      selection(5, 5, range(4, 5, 5, 5))
    );
  });

  it('keeps the earlier ranges while Shift grows the last', () => {
    const multi = selection(5, 5, range(0, 0, 1, 1), range(5, 5, 5, 5));

    expect(move(multi, 'ArrowDown', { shift: true }).ranges).toEqual([
      range(0, 0, 1, 1),
      range(5, 5, 6, 5),
    ]);
  });

  it('extends to the grid edge under Ctrl and Shift together', () => {
    expect(move(at(50, 5), 'ArrowDown', { shift: true, ctrl: true })).toEqual(
      selection(50, 5, range(50, 5, 99, 5))
    );
    expect(move(at(50, 5), 'ArrowLeft', { shift: true, ctrl: true })).toEqual(
      selection(50, 5, range(50, 0, 50, 5))
    );
  });

  it('goes to the ends of the row with Home and End, and to the ends of the grid under Ctrl', () => {
    expect(move(at(50, 5), 'Home')).toEqual(at(50, 0));
    expect(move(at(50, 5), 'End')).toEqual(at(50, 9));
    expect(move(at(50, 5), 'Home', { ctrl: true })).toEqual(at(0, 0));
    expect(move(at(50, 5), 'End', { ctrl: true })).toEqual(at(99, 9));
    expect(move(at(50, 5), 'Home', { shift: true })).toEqual(
      selection(50, 5, range(50, 0, 50, 5))
    );
    expect(move(at(50, 5), 'End', { shift: true, ctrl: true })).toEqual(
      selection(50, 5, range(50, 5, 99, 9))
    );
  });

  it('moves a screen of rows with PageUp and PageDown, clamped, and at least one', () => {
    expect(move(at(50, 5), 'PageDown')).toEqual(at(60, 5));
    expect(move(at(50, 5), 'PageUp')).toEqual(at(40, 5));
    expect(move(at(95, 5), 'PageDown')).toEqual(at(99, 5));
    expect(move(at(5, 5), 'PageUp')).toEqual(at(0, 5));
    expect(move(at(50, 5), 'PageDown', {}, 0)).toEqual(at(51, 5));
    expect(move(at(50, 5), 'PageDown', {}, 2.9)).toEqual(at(52, 5));
    expect(move(at(50, 5), 'PageDown', { shift: true })).toEqual(
      selection(50, 5, range(50, 5, 60, 5))
    );
  });

  it('moves right with Tab and left with Shift+Tab, staying at the last column', () => {
    const multi = selection(5, 5, range(5, 5, 8, 8));

    expect(move(multi, 'Tab')).toEqual(at(5, 6));
    expect(move(multi, 'Tab', { shift: true })).toEqual(at(5, 4));

    const last = at(5, 9);

    expect(move(last, 'Tab')).toBe(last);
    expect(move(at(5, 0), 'Tab', { shift: true })).toEqual(at(5, 0));
  });

  it('moves down with Enter and up with Shift+Enter, staying at the last row', () => {
    expect(move(at(5, 5), 'Enter')).toEqual(at(6, 5));
    expect(move(at(5, 5), 'Enter', { shift: true })).toEqual(at(4, 5));

    const last = at(99, 5);

    expect(move(last, 'Enter')).toBe(last);
    expect(move(at(0, 5), 'Enter', { shift: true })).toEqual(at(0, 5));
  });

  it('selects the whole grid as one range with SelectAll, keeping the active cell', () => {
    const every = moveActive(at(500_000, 12), 'SelectAll', {}, MILLION, 30);

    expect(every).toEqual(selection(500_000, 12, range(0, 0, 999_999, 29)));
    expect(selectAll(at(500_000, 12), MILLION)).toEqual(every);
  });

  it('moves the farther corner of a select-all under Shift, the bottom right one on a tie', () => {
    const every = selectAll(at(0, 0), BOUNDS);

    expect(move(every, 'ArrowUp', { shift: true })).toEqual(
      selection(0, 0, range(0, 0, 98, 9))
    );
    expect(
      move(selectAll(at(80, 2), BOUNDS), 'ArrowDown', { shift: true })
    ).toEqual(selection(80, 2, range(1, 2, 80, 9)));

    const square: GridBounds = { rowCount: 11, colCount: 11 };

    expect(
      moveActive(
        selectAll(at(5, 5), square),
        'ArrowLeft',
        { shift: true },
        square,
        10
      )
    ).toEqual(selection(5, 5, range(5, 5, 10, 9)));
  });

  it('pulls an active cell left past the bounds back in before it moves', () => {
    const stale = at(150, 12);

    expect(move(stale, 'ArrowUp')).toEqual(at(98, 9));
    expect(move(stale, 'Tab')).toEqual(at(99, 9));
    expect(move(stale, 'ArrowUp', { shift: true })).toEqual(
      selection(99, 9, range(98, 9, 99, 9))
    );
  });

  it('extends from the active cell alone when a host handed no range', () => {
    expect(move(selection(5, 5), 'ArrowDown', { shift: true })).toEqual(
      selection(5, 5, range(5, 5, 6, 5))
    );
  });

  it('changes nothing on a grid with no rows', () => {
    const sel = at(0, 0);

    expect(moveActive(sel, 'ArrowDown', {}, EMPTY, 10)).toBe(sel);
    expect(moveActive(sel, 'SelectAll', {}, EMPTY, 10)).toBe(sel);
  });
});

describe('what a header paints', () => {
  it('tells every cell a range holds from one no range does', () => {
    const sel = selection(1, 1, range(1, 1, 2, 3), range(8, 0, 8, 0));

    expect(isSelected(sel, { row: 2, col: 3 })).toBe(true);
    expect(isSelected(sel, { row: 8, col: 0 })).toBe(true);
    expect(isSelected(sel, { row: 3, col: 3 })).toBe(false);
    expect(isSelected(sel, { row: 2, col: 4 })).toBe(false);
    expect(isSelected(sel, { row: 0, col: 1 })).toBe(false);
  });

  it('marks a column a range reaches apart from one a range spans top to bottom', () => {
    const sel = selection(
      0,
      6,
      range(10, 1, 20, 2),
      range(0, 6, 99, 6),
      range(0, 3, 50, 3)
    );
    const columns = selectedColumns(sel, BOUNDS);

    expect(columns).toEqual({
      intersected: [
        { start: 1, end: 3 },
        { start: 6, end: 6 },
      ],
      covered: [{ start: 6, end: 6 }],
    });
    expect(
      [0, 1, 2, 3, 4, 5, 6, 7].map(col => headerState(columns, col))
    ).toEqual([
      'none',
      'intersected',
      'intersected',
      'intersected',
      'none',
      'none',
      'covered',
      'none',
    ]);
  });

  it('marks a row a range spans across every column as covered', () => {
    const sel = selection(4, 0, range(2, 3, 3, 4), range(4, 0, 6, 9));
    const rows = selectedRows(sel, BOUNDS);

    expect(rows).toEqual({
      intersected: [{ start: 2, end: 6 }],
      covered: [{ start: 4, end: 6 }],
    });
    expect(headerState(rows, 3)).toBe('intersected');
    expect(headerState(rows, 5)).toBe('covered');
    expect(headerState(rows, 7)).toBe('none');
  });

  it('merges the spans of overlapping and touching ranges in index order', () => {
    const sel = selection(
      0,
      0,
      range(0, 8, 0, 9),
      range(0, 0, 0, 2),
      range(0, 1, 0, 4),
      range(0, 5, 0, 5)
    );

    expect(selectedColumns(sel, BOUNDS).intersected).toEqual([
      { start: 0, end: 5 },
      { start: 8, end: 9 },
    ]);
  });

  it('paints one covered span for a select-all of a million rows', () => {
    const every = selectAll(selectCell({ row: 0, col: 0 }), MILLION);

    expect(selectedRows(every, MILLION).covered).toEqual([
      { start: 0, end: 999_999 },
    ]);
    expect(selectedColumns(every, MILLION).covered).toEqual([
      { start: 0, end: 29 },
    ]);
  });

  it('lights nothing on a grid with no rows or no columns', () => {
    const sel = selection(0, 0, range(0, 0, 0, 0));
    const none = { intersected: [], covered: [] };

    for (const bounds of [
      { rowCount: 0, colCount: 30 },
      { rowCount: 10, colCount: 0 },
    ]) {
      expect(selectedRows(sel, bounds)).toEqual(none);
      expect(selectedColumns(sel, bounds)).toEqual(none);
    }
  });

  it('lights no header for a range that starts past the last row or column', () => {
    const sel = selection(
      50,
      2,
      range(1, 1, 2, 1),
      range(50, 2, 60, 3),
      range(4, 12, 5, 14)
    );
    const fewer = { rowCount: 10, colCount: 10 };

    expect(selectedColumns(sel, fewer).intersected).toEqual([
      { start: 1, end: 1 },
    ]);
    expect(selectedRows(sel, fewer).intersected).toEqual([
      { start: 1, end: 2 },
    ]);
  });
});

describe('the ranges the grid still holds', () => {
  it('cuts each range at the last row and column, and drops one past either', () => {
    expect(
      rangesInGrid(
        [range(0, 0, 199, 9), range(50, 8, 120, 20), range(100, 0, 105, 2)],
        { rowCount: 100, colCount: 9 }
      )
    ).toEqual([range(0, 0, 99, 8), range(50, 8, 99, 8)]);
  });

  it('keeps a range inside the grid as it is, and holds none on an empty grid', () => {
    expect(rangesInGrid([range(1, 1, 2, 2)], BOUNDS)).toEqual([
      range(1, 1, 2, 2),
    ]);
    expect(rangesInGrid([range(0, 0, 0, 0)], EMPTY)).toEqual([]);
    expect(
      rangesInGrid([range(0, 0, 0, 0)], { rowCount: 5, colCount: 0 })
    ).toEqual([]);
  });
});
