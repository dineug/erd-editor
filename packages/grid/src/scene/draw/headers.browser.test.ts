// drawHeaders on an offscreen canvas in Chromium: the column labels and the
// row numbers on the header background, the frozen border along the edges a
// region borders, and the highlight it paints over a region already drawn.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { rgba } from '@/__test-utils__/scene';
import { DEFAULT_FONT, measureFont } from '@/font';
import { columnOffsets } from '@/model/columns';
import type { HeaderSelection } from '@/model/selection';
import { createTextFitter, ELLIPSIS } from '@/model/text';
import type { ColumnDef } from '@/model/types';
import { baselineOffset } from '@/scene/draw/context';
import { drawHeaders, type HeaderBlock } from '@/scene/draw/headers';
import { lightTheme as theme } from '@/theme';

const COLUMNS: ColumnDef[] = [
  { id: 'a', label: 'A', width: 100 },
  { id: 'b', label: 'B', width: 100 },
  { id: 'c', label: 'C', width: 100 },
];

const metrics = measureFont(DEFAULT_FONT);

const CLEAR = [0, 0, 0, 0];

interface TextCall {
  text: string;
  x: number;
  y: number;
  fill: string;
}

function paintOn(block: Partial<HeaderBlock>, selection?: HeaderSelection) {
  const canvas = new OffscreenCanvas(400, 200);
  const context = canvas.getContext('2d')!;
  const texts: TextCall[] = [];
  const original = OffscreenCanvasRenderingContext2D.prototype.fillText;
  const fitter = createTextFitter();

  vi.spyOn(context, 'fillText').mockImplementation(function (
    this: OffscreenCanvasRenderingContext2D,
    text,
    x,
    y
  ) {
    texts.push({ text, x, y, fill: String(this.fillStyle) });
    original.call(this, text, x, y);
  });

  fitter.beginFrame(DEFAULT_FONT, metrics.maxAdvance);
  drawHeaders(
    context,
    {
      axis: 'column',
      width: 300,
      height: 20,
      origin: 0,
      start: 0,
      end: 2,
      rowHeight: 20,
      offsets: columnOffsets(COLUMNS),
      columns: COLUMNS,
      bottomEdge: true,
      rightEdge: false,
      ...block,
    },
    { theme, font: DEFAULT_FONT, metrics, fitter },
    selection
  );

  const pixel = (x: number, y: number) => [
    ...context.getImageData(x, y, 1, 1).data,
  ];

  return { pixel, texts };
}

const ROW_BLOCK: Partial<HeaderBlock> = {
  axis: 'row',
  width: 60,
  height: 100,
  start: 0,
  end: 4,
  bottomEdge: false,
  rightEdge: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawHeaders', () => {
  const baseline = baselineOffset(20, metrics);

  it('draws each column label centred on the header background, with the frozen border below', () => {
    const { pixel, texts } = paintOn({});

    expect(pixel(5, 5)).toEqual(rgba(theme.headerBackground));
    expect(pixel(99, 5)).toEqual(rgba(theme.gridLine));
    expect(pixel(299, 5)).toEqual(rgba(theme.gridLine));
    expect(pixel(50, 19)).toEqual(rgba(theme.frozenBorder));
    expect(pixel(350, 5)).toEqual(CLEAR);
    expect(texts).toEqual(
      ['A', 'B', 'C'].map((text, index) => ({
        text,
        x: index * 100 + 50,
        y: baseline,
        fill: theme.headerText,
      }))
    );
  });

  it('runs the frozen border down the right edge of the frozen header', () => {
    const { pixel } = paintOn({ end: 1, width: 200, rightEdge: true });

    expect(pixel(199, 5)).toEqual(rgba(theme.frozenBorder));
    expect(pixel(99, 5)).toEqual(rgba(theme.gridLine));
  });

  it('numbers the rows from 1, each centred, with the frozen border on the right', () => {
    const { pixel, texts } = paintOn({ ...ROW_BLOCK, origin: 20, end: 5 });

    expect(texts.map(call => call.text)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
    expect(texts[1]).toEqual({
      text: '2',
      x: 30,
      y: baseline,
      fill: theme.headerText,
    });
    expect(pixel(10, 19)).toEqual(rgba(theme.gridLine));
    expect(pixel(59, 10)).toEqual(rgba(theme.frozenBorder));
  });

  it('paints the corner with no cells and both borders', () => {
    const { pixel, texts } = paintOn({
      width: 60,
      start: 0,
      end: -1,
      rightEdge: true,
    });

    expect(texts).toEqual([]);
    expect(pixel(5, 5)).toEqual(rgba(theme.headerBackground));
    expect(pixel(59, 5)).toEqual(rgba(theme.frozenBorder));
    expect(pixel(5, 19)).toEqual(rgba(theme.frozenBorder));
  });

  it('cuts a label wider than its column with an ellipsis', () => {
    const columns = [{ id: 'a', label: 'A very long column label', width: 60 }];
    const { texts } = paintOn({
      width: 60,
      end: 0,
      columns,
      offsets: columnOffsets(columns),
    });

    expect(texts).toHaveLength(1);
    expect(texts[0].text.endsWith(ELLIPSIS)).toBe(true);
  });

  it('places its cells from the content offset it shows', () => {
    const { texts } = paintOn({ origin: 50 });

    expect(texts.map(call => call.x)).toEqual([0, 100, 200]);
  });
});

describe('drawHeaders over a selection', () => {
  it('paints only the cells the selection reaches, in the token for how it reaches them', () => {
    const { pixel, texts } = paintOn(
      {},
      { intersected: [{ start: 0, end: 2 }], covered: [{ start: 2, end: 2 }] }
    );

    expect(pixel(5, 5)).toEqual(rgba(theme.selectedHeaderBackground));
    expect(pixel(205, 5)).toEqual(rgba(theme.fullSelectionBackground));
    expect(pixel(99, 5)).toEqual(rgba(theme.gridLine));
    expect(pixel(50, 19)).toEqual(rgba(theme.frozenBorder));
    expect(texts.map(({ text, fill }) => [text, fill])).toEqual([
      ['A', theme.headerText],
      ['B', theme.headerText],
      ['C', theme.selectedHeaderText],
    ]);
  });

  it('leaves the rest of the region clear for the header drawn under it', () => {
    const { pixel, texts } = paintOn(
      { end: 1, width: 200, rightEdge: true },
      { intersected: [{ start: 0, end: 0 }], covered: [] }
    );

    expect(pixel(150, 5)).toEqual(CLEAR);
    expect(pixel(150, 19)).toEqual(CLEAR);
    expect(pixel(199, 5)).toEqual(CLEAR);
    expect(texts.map(call => call.text)).toEqual(['A']);
  });

  it('draws the frozen border again where a highlighted cell meets the edge', () => {
    const columns = paintOn(
      { end: 1, width: 200, rightEdge: true },
      { intersected: [{ start: 1, end: 1 }], covered: [{ start: 1, end: 1 }] }
    );
    const rows = paintOn(ROW_BLOCK, {
      intersected: [{ start: 1, end: 1 }],
      covered: [],
    });

    expect(columns.pixel(199, 5)).toEqual(rgba(theme.frozenBorder));
    expect(rows.pixel(5, 25)).toEqual(rgba(theme.selectedHeaderBackground));
    expect(rows.pixel(59, 25)).toEqual(rgba(theme.frozenBorder));
    expect(rows.pixel(59, 5)).toEqual(CLEAR);
    expect(rows.pixel(10, 39)).toEqual(rgba(theme.gridLine));
  });
});
