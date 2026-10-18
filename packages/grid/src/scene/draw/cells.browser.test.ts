// drawCells on an offscreen canvas in Chromium: the background and grid lines,
// the order a cell's background is chosen in, the text's place and colour,
// and the column clip that keeps a text the fitter left whole in its column.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { rgba } from '@/__test-utils__/scene';
import { DEFAULT_FONT, measureFont } from '@/font';
import { columnOffsets } from '@/model/columns';
import { createTextFitter, ELLIPSIS, type TextFitter } from '@/model/text';
import type { ColumnDef } from '@/model/types';
import { type CellBlock, type CellPaint, drawCells } from '@/scene/draw/cells';
import { baselineOffset } from '@/scene/draw/context';
import { lightTheme as theme } from '@/theme';

const COLUMNS: ColumnDef[] = [
  { id: 'a', label: 'A', width: 100 },
  { id: 'b', label: 'B', width: 100, readonly: true },
  { id: 'c', label: 'C', width: 100 },
];

const OUTSIDE = '#123456';

const metrics = measureFont(DEFAULT_FONT);

function startedFitter(): TextFitter {
  const fitter = createTextFitter();
  fitter.beginFrame(DEFAULT_FONT, metrics.maxAdvance);
  return fitter;
}

/** A fitter that leaves every text whole, as a draw past its measure budget does. */
const wholeFitter: TextFitter = {
  beginFrame() {},
  fit: text => text,
  hasDeferred: () => true,
  reserve() {},
  trim() {},
  reset() {},
};

interface TextCall {
  text: string;
  x: number;
  y: number;
  fill: string;
}

function paintOn(
  block: Partial<CellBlock> = {},
  paint: Partial<CellPaint> = {}
) {
  const canvas = new OffscreenCanvas(400, 200);
  const context = canvas.getContext('2d')!;
  const texts: TextCall[] = [];
  const original = OffscreenCanvasRenderingContext2D.prototype.fillText;

  vi.spyOn(context, 'fillText').mockImplementation(function (
    this: OffscreenCanvasRenderingContext2D,
    text,
    x,
    y
  ) {
    texts.push({ text, x, y, fill: String(this.fillStyle) });
    original.call(this, text, x, y);
  });

  // Paint outside the region first, so a spill shows as a changed pixel.
  context.fillStyle = OUTSIDE;
  context.fillRect(0, 0, 400, 200);

  drawCells(
    context,
    {
      width: 300,
      height: 100,
      left: 0,
      top: 0,
      rowStart: 0,
      rowEnd: 4,
      colStart: 0,
      colEnd: 2,
      rowHeight: 20,
      offsets: columnOffsets(COLUMNS),
      columns: COLUMNS,
      frozenEdge: false,
      ...block,
    },
    {
      theme,
      font: DEFAULT_FONT,
      metrics,
      fitter: startedFitter(),
      getCell: () => '',
      ...paint,
    }
  );

  const pixel = (x: number, y: number) => [
    ...context.getImageData(x, y, 1, 1).data,
  ];
  const clean = (x0: number, y0: number, x1: number, y1: number) => {
    const { data } = context.getImageData(x0, y0, x1 - x0, y1 - y0);
    const first = data.slice(0, 4).join();

    for (let index = 0; index < data.length; index += 4) {
      if (data.slice(index, index + 4).join() !== first) return false;
    }
    return true;
  };

  return { pixel, clean, texts };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawCells', () => {
  it('fills its region with the background and lines each cell right and below, nothing outside', () => {
    const { pixel } = paintOn();

    expect(pixel(50, 10)).toEqual(rgba(theme.background));
    expect(pixel(99, 10)).toEqual(rgba(theme.gridLine));
    expect(pixel(50, 19)).toEqual(rgba(theme.gridLine));
    expect(pixel(299, 50)).toEqual(rgba(theme.gridLine));
    expect(pixel(350, 50)).toEqual(rgba(OUTSIDE));
    expect(pixel(50, 150)).toEqual(rgba(OUTSIDE));
  });

  it('runs the frozen border down its right edge', () => {
    const { pixel } = paintOn({ frozenEdge: true });

    expect(pixel(299, 50)).toEqual(rgba(theme.frozenBorder));
    expect(pixel(199, 50)).toEqual(rgba(theme.gridLine));
  });

  it('takes the hook background, then the read-only one, then the theme', () => {
    const { pixel } = paintOn(
      {},
      {
        getCellStyle: (row, col) =>
          row === 0 && col === 0
            ? { readonly: true }
            : row === 1 && col === 1
              ? { background: '#ff0000' }
              : row === 2 && col === 0
                ? { background: '#00ff00', readonly: true }
                : undefined,
      }
    );
    const readonly = rgba(theme.readonlyBackground);

    expect(pixel(50, 10)).toEqual(readonly);
    expect(pixel(150, 10)).toEqual(readonly);
    expect(pixel(150, 30)).toEqual(rgba('#ff0000'));
    expect(pixel(50, 50)).toEqual(rgba('#00ff00'));
    expect(pixel(250, 10)).toEqual(rgba(theme.background));
    expect(pixel(50, 70)).toEqual(rgba(theme.background));
  });

  it('draws a text 8px in from its cell, centred on the row, in the hook colour over the theme', () => {
    const { texts } = paintOn(
      {},
      {
        getCell: (row, col) => (col === 0 && row < 2 ? `r${row}` : ''),
        getCellStyle: row => (row === 1 ? { color: '#00aa00' } : undefined),
      }
    );
    const baseline = baselineOffset(20, metrics);

    expect(texts).toEqual([
      { text: 'r0', x: 8, y: baseline, fill: theme.text },
      { text: 'r1', x: 8, y: 20 + baseline, fill: '#00aa00' },
    ]);
  });

  it('cuts a text wider than its cell with an ellipsis', () => {
    const { texts } = paintOn(
      {},
      {
        getCell: (row, col) =>
          row === 0 && col === 0 ? 'a value far wider than its cell' : '',
      }
    );

    expect(texts).toHaveLength(1);
    expect(texts[0].text.endsWith(ELLIPSIS)).toBe(true);
  });

  it('keeps a text the fitter left whole inside its column', () => {
    const { clean, pixel } = paintOn(
      {},
      {
        fitter: wholeFitter,
        getCell: (row, col) => (row === 0 && col === 1 ? 'W'.repeat(60) : ''),
      }
    );

    expect(clean(101, 1, 198, 18)).toBe(false);
    expect(clean(201, 1, 298, 18)).toBe(true);
    expect(pixel(250, 10)).toEqual(rgba(theme.background));
  });

  it('reads each getter once per cell drawn', () => {
    const getCell = vi.fn((_row: number, _col: number) => 'x');
    const getCellStyle = vi.fn(() => undefined);

    paintOn({ rowStart: 1, rowEnd: 3, colStart: 1 }, { getCell, getCellStyle });

    const cells = getCell.mock.calls.map(([row, col]) => `${row}:${col}`);

    expect(cells.sort()).toEqual(
      ['1:1', '1:2', '2:1', '2:2', '3:1', '3:2'].sort()
    );
    expect(getCellStyle).toHaveBeenCalledTimes(6);
  });

  it('paints only the background for no rows, and lines no further than the content', () => {
    const getCell = vi.fn(() => '');
    const empty = paintOn({ rowEnd: -1 }, { getCell });

    expect(getCell).not.toHaveBeenCalled();
    expect(empty.pixel(99, 10)).toEqual(rgba(theme.background));

    const short = paintOn({ rowEnd: 1, colEnd: 0 });

    expect(short.pixel(99, 10)).toEqual(rgba(theme.gridLine));
    expect(short.pixel(99, 60)).toEqual(rgba(theme.background));
    expect(short.pixel(50, 19)).toEqual(rgba(theme.gridLine));
    expect(short.pixel(150, 19)).toEqual(rgba(theme.background));
  });

  it('places its cells from the content offset it shows', () => {
    const { pixel, texts } = paintOn(
      { left: 50, top: 10 },
      { getCell: (row, col) => (row === 0 && col === 0 ? 'cut' : '') }
    );

    expect(pixel(49, 5)).toEqual(rgba(theme.gridLine));
    expect(pixel(50, 9)).toEqual(rgba(theme.gridLine));
    expect(texts).toEqual([expect.objectContaining({ text: 'cut', x: -42 })]);
  });
});
