import { describe, expect, it } from 'vite-plus/test';

import {
  areaCellCount,
  CELL_LIMIT,
  cellCount,
  copyableRanges,
  copyRows,
  fillTargets,
  parse,
  pasteCellCount,
  pasteTargets,
  serialize,
} from '@/model/tsv';
import type { CellRange, GridSelection } from '@/model/types';

const range = (
  startRow: number,
  startCol: number,
  endRow = startRow,
  endCol = startCol
): CellRange => ({ startRow, startCol, endRow, endCol });

const selection = (
  active: GridSelection['active'],
  ...ranges: CellRange[]
): GridSelection => ({ active, ranges });

/** A getter whose answer names its cell, so a value read in the wrong place shows. */
const cellName = (row: number, col: number) => `r${row}c${col}`;

describe('serialize', () => {
  it('writes a tab between cells and a newline after every row, the last too', () => {
    expect(
      serialize([
        ['a', 'b'],
        ['c', 'd'],
      ])
    ).toBe('a\tb\nc\td\n');
  });

  it('keeps empty cells and rows as their separators alone', () => {
    expect(serialize([['', ''], ['']])).toBe('\t\n\n');
    expect(serialize([['']])).toBe('\n');
    expect(serialize([])).toBe('');
  });

  it('turns a tab or a line break inside a value into a space, so the shape survives a paste', () => {
    const text = serialize([['one\ttwo', 'three\r\nfour'], ['five\nsix']]);

    expect(text).toBe('one two\tthree  four\nfive six\n');
    expect(parse(text)).toEqual([['one two', 'three  four'], ['five six']]);
  });

  it('writes quotes as they are', () => {
    expect(serialize([['"a"', "it's"]])).toBe('"a"\tit\'s\n');
  });
});

describe('parse', () => {
  it('splits rows on LF and on CRLF alike, and cells on tabs', () => {
    expect(parse('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parse('a\tb\r\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('drops the one newline after the last row, and keeps the empty rows before it', () => {
    expect(parse('a\tb\r\n')).toEqual([['a', 'b']]);
    expect(parse('a\n\n\r\n')).toEqual([['a'], [''], ['']]);
  });

  it('keeps an empty line between rows, and a row of empty cells at the end', () => {
    expect(parse('a\n\nb')).toEqual([['a'], [''], ['b']]);
    expect(parse('a\n\t\n')).toEqual([['a'], ['', '']]);
  });

  it('reads nothing out of empty text, and an empty cell out of a newline alone', () => {
    expect(parse('')).toEqual([]);
    expect(parse('\n')).toEqual([['']]);
    expect(parse('\r\n\n')).toEqual([[''], ['']]);
  });

  it('reads quotes as text, so a quoted tab still ends its cell', () => {
    expect(parse('"a\tb"\t"c"')).toEqual([['"a', 'b"', '"c"']]);
  });

  it('keeps rows of different lengths as they are', () => {
    expect(parse('a\tb\tc\nd')).toEqual([['a', 'b', 'c'], ['d']]);
  });

  it('keeps a lone carriage return inside its cell', () => {
    expect(parse('a\rb')).toEqual([['a\rb']]);
  });
});

describe('copyableRanges', () => {
  it('copies one range as its rows against its columns', () => {
    expect(copyableRanges([range(2, 1, 4, 3)])).toEqual({
      rows: [{ start: 2, end: 4 }],
      cols: [{ start: 1, end: 3 }],
    });
  });

  it('copies ranges over the same rows side by side, in column order whatever the selection order', () => {
    expect(copyableRanges([range(0, 5, 2, 5), range(0, 1, 2, 2)])).toEqual({
      rows: [{ start: 0, end: 2 }],
      cols: [
        { start: 1, end: 2 },
        { start: 5, end: 5 },
      ],
    });
  });

  it('copies ranges over the same columns stacked, in row order', () => {
    expect(copyableRanges([range(9, 0, 9, 3), range(3, 0, 4, 3)])).toEqual({
      rows: [
        { start: 3, end: 4 },
        { start: 9, end: 9 },
      ],
      cols: [{ start: 0, end: 3 }],
    });
  });

  it('names a column two ranges share once, and joins ranges that touch', () => {
    expect(copyableRanges([range(0, 0, 1, 2), range(0, 2, 1, 4)])).toEqual({
      rows: [{ start: 0, end: 1 }],
      cols: [{ start: 0, end: 4 }],
    });
    expect(copyableRanges([range(0, 0, 0, 1), range(0, 2, 0, 3)])).toEqual({
      rows: [{ start: 0, end: 0 }],
      cols: [{ start: 0, end: 3 }],
    });
    expect(copyableRanges([range(1, 1, 5, 1), range(2, 1, 3, 1)])).toEqual({
      rows: [{ start: 1, end: 5 }],
      cols: [{ start: 1, end: 1 }],
    });
  });

  it('copies the same cell clicked twice once', () => {
    expect(copyableRanges([range(3, 3), range(3, 3)])).toEqual({
      rows: [{ start: 3, end: 3 }],
      cols: [{ start: 3, end: 3 }],
    });
  });

  it('refuses ranges that share neither their rows nor their columns', () => {
    expect(copyableRanges([range(0, 0, 2, 0), range(1, 2, 3, 2)])).toBeNull();
    expect(copyableRanges([range(0, 0), range(1, 1)])).toBeNull();
    expect(
      copyableRanges([range(0, 0, 1, 1), range(0, 3, 1, 3), range(5, 0, 5, 1)])
    ).toBeNull();
  });

  it('copies nothing, and refuses nothing, where there is no range', () => {
    expect(copyableRanges([])).toEqual({ rows: [], cols: [] });
  });

  it('hands back spans of its own, so the area cannot rewrite the selection', () => {
    const ranges = [range(0, 0, 1, 1)];
    const area = copyableRanges(ranges);

    area!.rows[0].end = 99;
    area!.cols[0].end = 99;
    expect(ranges[0]).toEqual(range(0, 0, 1, 1));
  });
});

describe('copyRows', () => {
  it('reads every row of the area against every column, in sheet order', () => {
    const area = copyableRanges([range(1, 4, 2, 4), range(1, 0, 2, 1)])!;

    expect(copyRows(area, cellName)).toEqual([
      ['r1c0', 'r1c1', 'r1c4'],
      ['r2c0', 'r2c1', 'r2c4'],
    ]);
  });

  it('stacks the rows of ranges over the same columns', () => {
    const area = copyableRanges([range(7, 2), range(0, 2, 1, 2)])!;

    expect(copyRows(area, cellName)).toEqual([['r0c2'], ['r1c2'], ['r7c2']]);
  });

  it('asks the getter once for each cell it copies', () => {
    const asked: string[] = [];
    const area = copyableRanges([range(0, 0, 1, 2), range(0, 1, 1, 1)])!;

    copyRows(area, (row, col) => {
      asked.push(cellName(row, col));
      return '';
    });
    expect(asked).toEqual(['r0c0', 'r0c1', 'r0c2', 'r1c0', 'r1c1', 'r1c2']);
  });

  it('round-trips through the text a copy writes and a paste reads', () => {
    const rows = copyRows(copyableRanges([range(0, 0, 1, 1)])!, cellName);

    expect(parse(serialize(rows))).toEqual(rows);
  });

  it('round-trips one column whose last cells are empty, and one empty cell', () => {
    const column = [['x'], ['y'], [''], ['']];

    expect(parse(serialize(column))).toEqual(column);
    expect(parse(serialize([['']]))).toEqual([['']]);
  });
});

describe('cell counts', () => {
  it('counts the cells ranges cover, one two ranges share once', () => {
    expect(cellCount([])).toBe(0);
    expect(cellCount([range(0, 0, 1, 2)])).toBe(6);
    expect(cellCount([range(0, 0, 1, 1), range(1, 1, 2, 2)])).toBe(7);
    expect(cellCount([range(0, 0, 3, 3), range(1, 1, 2, 2)])).toBe(16);
    expect(cellCount([range(0, 0), range(0, 0)])).toBe(1);
    expect(cellCount([range(0, 0, 0, 1), range(5, 3, 6, 3)])).toBe(4);
  });

  it('counts a whole million-row sheet without walking its cells', () => {
    expect(cellCount([range(0, 0, 999_999, 29)])).toBe(30_000_000);
  });

  it('counts the cells a copy area reads', () => {
    expect(areaCellCount({ rows: [], cols: [] })).toBe(0);
    expect(
      areaCellCount(copyableRanges([range(0, 0, 1, 1), range(0, 4, 1, 4)])!)
    ).toBe(6);
  });

  it('counts the cells a paste writes, a one-cell clipboard filling its ranges', () => {
    const sel = selection({ row: 0, col: 0 }, range(0, 0, 9, 9));

    expect(pasteCellCount(sel, [['v']])).toBe(100);
    expect(pasteCellCount(sel, [['a', 'b'], ['c']])).toBe(3);
  });

  it('holds a request to a million cells', () => {
    expect(CELL_LIMIT).toBe(1_000_000);
  });
});

describe('fillTargets', () => {
  it('writes the value to every cell of every range, range by range', () => {
    expect(fillTargets([range(0, 0, 0, 1), range(4, 4)], 'x')).toEqual([
      { row: 0, col: 0, value: 'x' },
      { row: 0, col: 1, value: 'x' },
      { row: 4, col: 4, value: 'x' },
    ]);
  });

  it('writes a cell two ranges share once', () => {
    const writes = fillTargets([range(0, 0, 1, 1), range(1, 1, 2, 2)], '');

    expect(writes.map(({ row, col }) => cellName(row, col))).toEqual([
      'r0c0',
      'r0c1',
      'r1c0',
      'r1c1',
      'r1c2',
      'r2c1',
      'r2c2',
    ]);
  });

  it('writes nothing without a range', () => {
    expect(fillTargets([], 'x')).toEqual([]);
  });
});

describe('pasteTargets', () => {
  it('fills every range with a clipboard of one cell', () => {
    const targets = pasteTargets(
      selection({ row: 5, col: 5 }, range(0, 0, 1, 0), range(5, 5)),
      [['v']]
    );

    expect(targets).toEqual([
      { row: 0, col: 0, value: 'v' },
      { row: 1, col: 0, value: 'v' },
      { row: 5, col: 5, value: 'v' },
    ]);
  });

  it('writes more than one cell once, from the active cell, whatever the ranges cover', () => {
    const targets = pasteTargets(
      selection({ row: 2, col: 1 }, range(0, 0, 9, 9), range(2, 1)),
      [
        ['a', 'b'],
        ['c', 'd'],
      ]
    );

    expect(targets).toEqual([
      { row: 2, col: 1, value: 'a' },
      { row: 2, col: 2, value: 'b' },
      { row: 3, col: 1, value: 'c' },
      { row: 3, col: 2, value: 'd' },
    ]);
  });

  it('anchors at the active cell even where it is the bottom right of its range', () => {
    const targets = pasteTargets(
      selection({ row: 4, col: 4 }, range(2, 2, 4, 4)),
      [['a', 'b']]
    );

    expect(targets.map(({ row, col }) => cellName(row, col))).toEqual([
      'r4c4',
      'r4c5',
    ]);
  });

  it('keeps the rows past the end of the grid, which the host may add', () => {
    const rowCount = 3;
    const targets = pasteTargets(selection({ row: 2, col: 0 }, range(2, 0)), [
      ['a'],
      ['b'],
      ['c'],
    ]);

    expect(targets.map(target => target.row)).toEqual([2, 3, 4]);
    expect(targets.filter(target => target.row >= rowCount)).toHaveLength(2);
  });

  it('keeps the columns past the end too, which the caller drops and reports', () => {
    const targets = pasteTargets(selection({ row: 0, col: 1 }, range(0, 1)), [
      ['a', 'b', 'c'],
    ]);

    expect(targets.map(target => target.col)).toEqual([1, 2, 3]);
  });

  it('writes a ragged clipboard row by row, each as long as it is', () => {
    const targets = pasteTargets(selection({ row: 0, col: 0 }, range(0, 0)), [
      ['a', 'b'],
      ['c'],
    ]);

    expect(targets).toEqual([
      { row: 0, col: 0, value: 'a' },
      { row: 0, col: 1, value: 'b' },
      { row: 1, col: 0, value: 'c' },
    ]);
  });

  it('writes nothing from an empty clipboard', () => {
    expect(
      pasteTargets(selection({ row: 0, col: 0 }, range(0, 0)), parse(''))
    ).toEqual([]);
  });

  it('reads a spreadsheet copy of one cell, newline and all, as one cell', () => {
    const targets = pasteTargets(
      selection({ row: 0, col: 0 }, range(0, 0, 0, 1)),
      parse('v\r\n')
    );

    expect(targets.map(target => target.value)).toEqual(['v', 'v']);
  });
});
