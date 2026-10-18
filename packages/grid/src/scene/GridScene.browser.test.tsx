// A million-row grid's scene in real Chromium: what each region paints after
// a scroll, how many cells a draw reads, where text and selection are clipped
// and what each setter redraws, every pixel and count read after drawn().

import { prepareWithSegments } from '@chenglou/pretext';
import { markDirty, renderKonva, whenDrawn } from '@dineug/r-html-konva';
import { Konva } from 'konva/lib/Global';
import type { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { drawn, near, pixelAt, rgba } from '@/__test-utils__/scene';
import { DEFAULT_FONT } from '@/font';
import { clickColumnHeader, selectCell } from '@/model/selection';
import { ELLIPSIS, MISS_BUDGET } from '@/model/text';
import type { CellStyle, ColumnDef, GridSelection } from '@/model/types';
import { rowHeaderWidth } from '@/model/viewport';
import { renderGridScene } from '@/scene/GridScene';
import {
  createSceneState,
  type SceneInit,
  type SceneState,
} from '@/scene/state';
import { darkTheme, lightTheme } from '@/theme';

const ROW_COUNT = 1_000_000;

const WIDTH = 960;

const HEIGHT = 600;

/** A spreadsheet's column letters, bijective base 26: A to Z, then AA, AB and on. */
const columnLabel = (index: number) => {
  let label = '';
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    label = String.fromCharCode(65 + ((rest - 1) % 26)) + label;
  }

  return label;
};

const COLUMNS: ColumnDef[] = Array.from({ length: 30 }, (_, index) => ({
  id: `c${index}`,
  label: columnLabel(index),
}));

/** Short enough that the right half of a 120px cell stays background. */
const valueOf = (row: number, col: number) => `${row}:${col}`;

interface Mounted {
  stage: Stage;
  scene: SceneState;
  body: Layer;
  overlay: Layer;
}

const mounted: Mounted[] = [];

async function mount(init: Partial<SceneInit> = {}): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);

  const width = init.width ?? WIDTH;
  const height = init.height ?? HEIGHT;
  const stage = new Stage({ container, width, height, listening: false });
  const scene = createSceneState({
    rowCount: ROW_COUNT,
    columns: COLUMNS,
    getCell: valueOf,
    ...init,
    width,
    height,
  });

  renderGridScene(stage, scene);
  await drawn();

  const entry: Mounted = {
    stage,
    scene,
    body: stage.findOne<Layer>('.grid-body') as Layer,
    overlay: stage.findOne<Layer>('.grid-overlay') as Layer,
  };
  mounted.push(entry);

  return entry;
}

afterEach(async () => {
  await whenDrawn();

  for (const { stage } of mounted.splice(0)) {
    const container = stage.container();
    renderKonva(stage, null);
    stage.destroy();
    container.remove();
  }

  await whenDrawn();
  vi.restoreAllMocks();
});

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a cell is on the stage at the scene's scroll offsets. */
function cellBox(scene: SceneState, row: number, col: number): Box {
  const { layout, offsets, rowHeight, scrollTop, scrollLeft } = scene.state;
  const x =
    col < layout.frozenCount
      ? layout.frozenBody.x + offsets[col]
      : layout.body.x + offsets[col] - layout.scrollOrigin - scrollLeft;

  return {
    x,
    y: layout.body.y + row * rowHeight - scrollTop,
    width: offsets[col + 1] - offsets[col],
    height: rowHeight,
  };
}

/** A point in a cell clear of its left aligned text. */
const clearOfText = (box: Box) => ({
  x: box.x + box.width - 12,
  y: box.y + box.height / 2,
});

/** A point in a header cell clear of its centred label. */
const clearOfLabel = (box: Box) => ({
  x: box.x + 4,
  y: box.y + box.height / 2,
});

function columnHeaderBox(scene: SceneState, col: number): Box {
  const cell = cellBox(scene, 0, col);

  return { ...cell, y: 0, height: scene.state.layout.headerHeight };
}

function rowHeaderBox(scene: SceneState, row: number): Box {
  const cell = cellBox(scene, row, 0);

  return { ...cell, x: 0, width: scene.state.layout.rowHeaderWidth };
}

const colourAt = (layer: Layer, point: { x: number; y: number }) =>
  pixelAt(layer, point.x, point.y);

interface TextCall {
  canvas: HTMLCanvasElement;
  text: string;
  /** Where the text starts in canvas pixels, the context's transform applied. */
  x: number;
  y: number;
  fill: string;
  font: string;
}

/** Records every fillText with the state it was drawn in, and still draws it. */
function spyText(): TextCall[] {
  const calls: TextCall[] = [];
  const original = CanvasRenderingContext2D.prototype.fillText;

  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation(
    function (this: CanvasRenderingContext2D, text, x, y, maxWidth) {
      const at = this.getTransform().transformPoint({ x, y });

      calls.push({
        canvas: this.canvas,
        text,
        x: at.x,
        y: at.y,
        fill: String(this.fillStyle),
        font: this.font,
      });
      original.call(this, text, x, y, maxWidth);
    }
  );

  return calls;
}

/** The texts drawn on one layer, placed in stage coordinates. */
function textsOn(calls: TextCall[], layer: Layer): TextCall[] {
  const canvas = layer.getCanvas();
  const ratio = canvas.getPixelRatio();

  return calls
    .filter(call => call.canvas === canvas._canvas)
    .map(call => ({ ...call, x: call.x / ratio, y: call.y / ratio }));
}

/** Every pixel of a box's inside, one in from its edges, as colours. */
function pixelsIn(layer: Layer, box: Box): number[][] {
  const found: number[][] = [];

  for (let y = box.y + 1; y < box.y + box.height - 1; y++) {
    for (let x = box.x + 1; x < box.x + box.width - 1; x++) {
      found.push(pixelAt(layer, x, y));
    }
  }

  return found;
}

interface GetterCounts {
  cell: number;
  style: number;
}

/**
 * Counts each getter's calls per draw of the body layer, the counters reset
 * as the draw begins, and swaps the counted getters in.
 */
function countGetters(
  { scene, body }: Mounted,
  getCell = valueOf,
  getCellStyle: (row: number, col: number) => CellStyle | undefined = () =>
    undefined
): GetterCounts[] {
  const draws: GetterCounts[] = [];
  let counts: GetterCounts = { cell: 0, style: 0 };

  body.on('beforeDraw.spec', () => {
    counts = { cell: 0, style: 0 };
  });
  body.on('draw.spec', () => {
    draws.push(counts);
  });
  scene.setGetters(
    (row, col) => {
      counts.cell++;
      return getCell(row, col);
    },
    (row, col) => {
      counts.style++;
      return getCellStyle(row, col);
    }
  );

  return draws;
}

/**
 * The bounds a draw's calls to each getter must keep: every cell in view at
 * least, and at most two more rows and one more column on every side.
 */
function getterBounds(scene: SceneState) {
  const strict = scene.visibleRange({ rows: 0, cols: 0 });
  const rows = strict.rowEnd - strict.rowStart + 1;
  const cols = strict.frozenEnd + 1 + strict.colEnd - strict.colStart + 1;

  return { lower: rows * cols, upper: (rows + 4) * (cols + 2) };
}

function expectWithin(draws: GetterCounts[], scene: SceneState) {
  const { lower, upper } = getterBounds(scene);
  const last = draws[draws.length - 1];

  expect(draws.length).toBeGreaterThan(0);
  expect(lower).toBeGreaterThan(0);
  for (const { cell, style } of draws) {
    expect(cell).toBeLessThanOrEqual(upper);
    expect(style).toBeLessThanOrEqual(upper);
  }
  expect(last.cell).toBeGreaterThanOrEqual(lower);
  expect(last.style).toBeGreaterThanOrEqual(lower);
}

describe('the fixed regions', () => {
  /** The first scrolling column whose left edge is in view, where the column header region starts. */
  function firstScrollingColumn(scene: SceneState): number {
    const { layout, offsets, scrollLeft } = scene.state;
    let col = layout.frozenCount;

    while (offsets[col] < layout.scrollOrigin + scrollLeft) col++;

    return col;
  }

  function expectFixedRegions({ scene, body }: Mounted, calls: TextCall[]) {
    const { layout, theme } = scene.state;
    const col = firstScrollingColumn(scene);
    const header = columnHeaderBox(scene, col);
    const frozenEdge = layout.frozenBody.x + layout.frozenWidth - 1;
    const midBody = layout.body.y + layout.body.height / 2;
    const label = textsOn(calls, body).filter(
      call => call.text === COLUMNS[col].label
    );

    expect(header.x).toBeGreaterThanOrEqual(layout.columnHeader.x);
    expect(colourAt(body, clearOfLabel(header))).toEqual(
      rgba(theme.headerBackground)
    );
    expect(label.map(call => call.x)).toContain(header.x + header.width / 2);
    expect(pixelAt(body, 4, 4)).toEqual(rgba(theme.headerBackground));
    expect(pixelAt(body, header.x + 30, layout.headerHeight - 1)).toEqual(
      rgba(theme.frozenBorder)
    );
    expect(pixelAt(body, layout.rowHeaderWidth - 1, midBody)).toEqual(
      rgba(theme.frozenBorder)
    );
    expect(pixelAt(body, frozenEdge, midBody)).toEqual(
      rgba(theme.frozenBorder)
    );
    expect(pixelAt(body, frozenEdge + 1, midBody)).not.toEqual(
      rgba(theme.frozenBorder)
    );
  }

  it('paints the headers, the row numbers and the frozen boundary in the theme', async () => {
    const calls = spyText();
    const view = await mount({ frozenColumns: 2 });
    const { scene, body } = view;
    const { theme } = scene.state;
    const cell = cellBox(scene, 1, 3);
    const texts = textsOn(calls, body).map(call => call.text);

    expectFixedRegions(view, calls);
    expect(colourAt(body, clearOfText(cell))).toEqual(rgba(theme.background));
    expect(pixelAt(body, cell.x + cell.width - 1, cell.y + 10)).toEqual(
      rgba(theme.gridLine)
    );
    expect(pixelAt(body, cell.x + 40, cell.y + cell.height - 1)).toEqual(
      rgba(theme.gridLine)
    );
    expect(texts).toEqual(
      expect.arrayContaining(['A', 'B', 'C', '1', '2', '0:0', '1:3'])
    );
  });

  it('keeps them in place after a vertical and a horizontal scroll', async () => {
    const view = await mount({ frozenColumns: 2 });
    const { stage, scene, body } = view;
    const calls = spyText();
    const top = 500_000 * 28 + 14;

    scene.setScroll(top, 300);
    await drawn();

    const { layout } = scene.state;
    const texts = textsOn(calls, body);
    const frozenRight = layout.frozenBody.x + layout.frozenWidth;
    const rowNumbers = texts.filter(call => call.x < layout.rowHeaderWidth);
    const frozenCells = texts.filter(
      call => call.x >= layout.frozenBody.x && call.x < frozenRight
    );

    const firstRow = rowHeaderBox(scene, 500_000);
    const headerBackground = rgba(scene.state.theme.headerBackground).join();

    expect(scene.state.scrollTop).toBe(top);
    expect(firstScrollingColumn(scene)).toBe(5);
    expectFixedRegions(view, calls);
    expect(rowNumbers.map(call => call.text)).toContain('500001');
    // Half of row 500000 is in view under the column header, its number ink.
    expect(
      pixelsIn(body, { ...firstRow, y: layout.body.y, height: 14 }).some(
        colour => colour.join() !== headerBackground
      )
    ).toBe(true);
    expect(pixelAt(body, 4, firstRow.y + firstRow.height - 1)).toEqual(
      rgba(scene.state.theme.gridLine)
    );
    expect(frozenCells.map(call => call.text)).toEqual(
      expect.arrayContaining(['A', 'B', '500000:0', '500001:1'])
    );

    // Columns 3 and 4 start left of the boundary, 300px of scroll past the
    // frozen ones, and draw there; with the frozen shapes hidden, nothing of
    // them shows left of it, so the scrolling regions' own clip cut them.
    const row = cellBox(scene, 500_001, 0);
    const across = (y: number) =>
      Array.from({ length: layout.frozenWidth }, (_, dx) =>
        pixelAt(body, layout.frozenBody.x + dx, y)
      );

    expect(
      texts.filter(call => call.x < frozenRight).map(call => call.text)
    ).toEqual(expect.arrayContaining(['500001:3', '500001:4', 'D']));

    for (const name of ['.grid-frozen-cells', '.grid-frozen-header']) {
      stage.findOne(name)?.visible(false);
    }
    markDirty(body);
    await drawn();

    expect(across(row.y + row.height / 2).every(([, , , a]) => a === 0)).toBe(
      true
    );
    expect(across(layout.headerHeight / 2).every(([, , , a]) => a === 0)).toBe(
      true
    );
    expect(pixelAt(body, frozenRight, row.y + 4)).toEqual(
      rgba(scene.state.theme.background)
    );
  });
});

describe('the getters a draw reads', () => {
  it('calls each one once per drawn cell, the overscan at most, at any scroll', async () => {
    const view = await mount({ frozenColumns: 1 });
    const { scene } = view;
    const draws = countGetters(view);
    await drawn();

    expectWithin(draws, scene);

    for (const [top, left] of [
      [28 * 123_456 + 7, 250],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ]) {
      draws.length = 0;
      scene.setScroll(top, left);
      await drawn();

      expectWithin(draws, scene);
    }

    expect(scene.state.scrollTop).toBe(scene.state.layout.maxScrollTop);
  });

  it('keeps to the bounds when long texts outrun the measure budget, and cuts every one by the end', async () => {
    const narrow = COLUMNS.map(column => ({ ...column, width: 60 }));
    const view = await mount({ columns: narrow, height: 900 });
    const { scene, body } = view;
    const calls = spyText();
    const long = (row: number, col: number) =>
      `a long cell value that overflows ${row} by ${col}`;
    const lastDraw: TextCall[] = [];

    body.on('beforeDraw.spec-text', () => {
      calls.length = 0;
    });
    body.on('draw.spec-text', () => {
      lastDraw.splice(0, lastDraw.length, ...textsOn(calls, body));
    });

    const draws = countGetters(view, long);
    await drawn();

    const { layout } = scene.state;
    const cellTexts = lastDraw.filter(
      call => call.x >= layout.body.x && call.y > layout.headerHeight
    );

    expect(getterBounds(scene).lower).toBeGreaterThan(MISS_BUDGET);
    expect(draws.length).toBeGreaterThan(1);
    expectWithin(draws, scene);
    expect(cellTexts.length).toBeGreaterThanOrEqual(getterBounds(scene).lower);
    expect(cellTexts.every(call => call.text.endsWith(ELLIPSIS))).toBe(true);
  });
});

describe('a text wider than its cell', () => {
  const LONG = 'The quick brown fox jumps over the lazy dog';

  const getCell = (row: number, col: number) =>
    row === 0 && col === 0 ? LONG : col === 1 ? '' : valueOf(row, col);

  function cellText(calls: TextCall[], view: Mounted) {
    const box = cellBox(view.scene, 0, 0);

    return textsOn(calls, view.body).filter(
      call => call.x === box.x + 8 && call.y > box.y && call.y < box.y + 28
    );
  }

  function expectNoInk(view: Mounted, row: number, col: number) {
    const background = rgba(view.scene.state.theme.background);

    expect(
      pixelsIn(view.body, cellBox(view.scene, row, col)).every(
        colour => colour.join() === background.join()
      )
    ).toBe(true);
  }

  it('is cut with an ellipsis inside its cell, and shown whole once the column widens', async () => {
    const calls = spyText();
    const view = await mount({ getCell });
    const { scene } = view;

    const [cut] = cellText(calls, view).slice(-1);
    expect(cut.text.endsWith(ELLIPSIS)).toBe(true);
    expect(LONG.startsWith(cut.text.slice(0, -1))).toBe(true);
    expectNoInk(view, 0, 1);

    calls.length = 0;
    scene.setResize({ col: 0, width: 400 });
    await drawn();

    const narrowRight = 120;
    const widened = cellBox(scene, 0, 0);
    const ink = pixelsIn(view.body, {
      ...widened,
      x: widened.x + narrowRight,
      width: 160,
    }).some(colour => colour.join() !== rgba(lightTheme.background).join());

    expect(cellText(calls, view).map(call => call.text)).toContain(LONG);
    expect(ink).toBe(true);
    expectNoInk(view, 0, 1);

    calls.length = 0;
    scene.setResize(null);
    await drawn();

    expect(cellText(calls, view).map(call => call.text)).toContain(cut.text);

    calls.length = 0;
    scene.setColumns(
      COLUMNS.map((column, index) =>
        index === 0 ? { ...column, width: 400 } : column
      )
    );
    await drawn();

    expect(cellText(calls, view).map(call => call.text)).toContain(LONG);
    expectNoInk(view, 0, 1);
  });
});

describe('the style hook and the read-only background', () => {
  it('paints a hook background and text colour over the theme', async () => {
    const calls = spyText();
    const view = await mount({
      getCellStyle: (row, col) =>
        row === 1 && col === 1
          ? { background: '#ff0000', color: '#00aa00' }
          : undefined,
    });
    const { scene, body } = view;
    const styled = cellBox(scene, 1, 1);
    const [text] = textsOn(calls, body).filter(call => call.text === '1:1');
    const green = pixelsIn(body, styled).some(
      ([r, g, b]) => g > 100 && r < 120 && b < 120
    );

    expect(colourAt(body, clearOfText(styled))).toEqual(rgba('#ff0000'));
    expect(text.fill).toBe('#00aa00');
    expect(green).toBe(true);
    expect(colourAt(body, clearOfText(cellBox(scene, 1, 2)))).toEqual(
      rgba(lightTheme.background)
    );
  });

  it('paints the read-only background for a read-only column and a read-only cell', async () => {
    const columns = COLUMNS.map((column, index) =>
      index === 3 ? { ...column, readonly: true } : column
    );
    const view = await mount({
      columns,
      getCellStyle: (row, col) =>
        row === 2 && col === 1
          ? { readonly: true }
          : row === 4 && col === 3
            ? { background: '#ff0000' }
            : undefined,
    });
    const { scene, body } = view;
    const readonly = rgba(lightTheme.readonlyBackground);

    expect(colourAt(body, clearOfText(cellBox(scene, 0, 3)))).toEqual(readonly);
    expect(colourAt(body, clearOfText(cellBox(scene, 2, 1)))).toEqual(readonly);
    expect(colourAt(body, clearOfText(cellBox(scene, 2, 2)))).toEqual(
      rgba(lightTheme.background)
    );
    expect(colourAt(body, clearOfText(cellBox(scene, 4, 3)))).toEqual(
      rgba('#ff0000')
    );
  });

  it('paints a whole selected column in the full selection tokens and the column in the selection fill', async () => {
    const view = await mount();
    const { scene, overlay } = view;
    const calls = spyText();
    const bounds = { rowCount: ROW_COUNT, colCount: COLUMNS.length };

    scene.setSelection(clickColumnHeader(scene.state.selection, 2, {}, bounds));
    await drawn();

    const labels = textsOn(calls, overlay);
    const [label] = labels.filter(call => call.text === 'C');
    const [rowNumber] = labels.filter(call => call.text === '4');
    const fill = colourAt(overlay, clearOfText(cellBox(scene, 5, 2)));

    expect(colourAt(overlay, clearOfLabel(columnHeaderBox(scene, 2)))).toEqual(
      rgba(lightTheme.fullSelectionBackground)
    );
    expect(label.fill).toBe(lightTheme.selectedHeaderText);
    expect(colourAt(overlay, clearOfLabel(rowHeaderBox(scene, 3)))).toEqual(
      rgba(lightTheme.selectedHeaderBackground)
    );
    expect(rowNumber.fill).toBe(lightTheme.headerText);
    expect(fill[3]).toBe(rgba(lightTheme.selectionFill)[3]);
    expect(near(fill, rgba(lightTheme.selectionFill), 12)).toBe(true);
    expect(colourAt(overlay, clearOfLabel(columnHeaderBox(scene, 3)))[3]).toBe(
      0
    );
  });
});

describe('a new theme, font or version', () => {
  it('redraws both layers in a new theme, reading the cells in view once more', async () => {
    const view = await mount();
    const { scene, body, overlay } = view;
    const draws = countGetters(view);
    await drawn();

    draws.length = 0;
    scene.setTheme(darkTheme);
    await drawn();

    const active = cellBox(scene, 0, 0);

    expectWithin(draws, scene);
    expect(colourAt(body, clearOfText(cellBox(scene, 2, 2)))).toEqual(
      rgba(darkTheme.background)
    );
    expect(pixelAt(body, 4, 4)).toEqual(rgba(darkTheme.headerBackground));
    expect(pixelAt(overlay, active.x, active.y + 10)).toEqual(
      rgba(darkTheme.activeCellBorder)
    );
  });

  it('measures and draws in a new font, the row-number header with it', async () => {
    const font = 'bold 18px serif';
    const view = await mount();
    const { scene, body } = view;
    const draws = countGetters(view);
    await drawn();
    const calls = spyText();
    const before = scene.state.layout.rowHeaderWidth;

    draws.length = 0;
    scene.setFont(font);
    await drawn();

    expectWithin(draws, scene);

    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font;
    const digit = Math.max(
      ...'0123456789'.split('').map(text => probe.measureText(text).width)
    );
    const { layout } = scene.state;
    const texts = textsOn(calls, body);

    expect(layout.rowHeaderWidth).toBe(rowHeaderWidth(ROW_COUNT, digit));
    expect(layout.rowHeaderWidth).toBeGreaterThan(before);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every(call => call.font === probe.font)).toBe(true);
    expect(
      pixelAt(body, layout.rowHeaderWidth - 1, layout.body.y + 40)
    ).toEqual(rgba(lightTheme.frozenBorder));
  });

  it('reads every cell in view again when the version goes up, and only then', async () => {
    const values = new Map<string, string>();
    const view = await mount();
    const { scene, body } = view;
    const draws = countGetters(
      view,
      (row, col) => values.get(`${row}:${col}`) ?? valueOf(row, col)
    );
    await drawn();
    const calls = spyText();

    values.set('0:0', 'changed');
    draws.length = 0;
    scene.setVersion(1);
    await drawn();

    expectWithin(draws, scene);
    expect(textsOn(calls, body).map(call => call.text)).toContain('changed');

    draws.length = 0;
    scene.setVersion(1);
    await drawn();

    expect(draws).toEqual([]);
  });
});

describe('the selection at the frozen boundary', () => {
  const lastRows = (startCol: number, endCol: number): GridSelection => ({
    active: { row: ROW_COUNT - 10, col: startCol },
    ranges: [
      { startRow: ROW_COUNT - 10, startCol, endRow: ROW_COUNT - 1, endCol },
    ],
  });

  it('is clipped on both sides at the last scroll offset, before and after a horizontal scroll', async () => {
    const view = await mount({ frozenColumns: 2 });
    const { scene, body, overlay } = view;
    const fillAlpha = rgba(lightTheme.selectionFill)[3];

    scene.setSelection(lastRows(0, 3));
    scene.setScroll(Number.MAX_SAFE_INTEGER, 0);
    await drawn();

    const { layout, rowHeight } = scene.state;
    const boundary = layout.frozenBody.x + layout.frozenWidth;
    const rangeTop =
      layout.body.y + (ROW_COUNT - 10) * rowHeight - scene.state.scrollTop;
    const y = rangeTop + rowHeight * 5 + rowHeight / 2;
    const alpha = (x: number, at = y) => pixelAt(overlay, x, at)[3];

    expect(scene.state.scrollTop).toBe(layout.maxScrollTop);
    for (const x of [boundary - 2, boundary - 1, boundary, boundary + 1]) {
      expect(alpha(x)).toBe(fillAlpha);
    }
    // The top edge runs on the grid line of the row above, on both sides.
    expect(alpha(boundary - 10, rangeTop - 1)).toBe(255);
    expect(alpha(boundary + 10, rangeTop - 1)).toBe(255);
    expect(alpha(boundary - 10, rangeTop)).toBe(fillAlpha);
    expect(alpha(boundary - 10, rangeTop - 2)).toBe(0);
    expect(pixelAt(body, boundary - 1, y)).toEqual(
      rgba(lightTheme.frozenBorder)
    );

    scene.setScroll(Number.MAX_SAFE_INTEGER, 200);
    await drawn();

    // Columns 2 and 3 span 240 to 480 in content, and 200px of scroll leaves
    // their last 40px in view right of the frozen ones.
    expect(alpha(boundary - 1)).toBe(fillAlpha);
    expect(alpha(boundary)).toBe(fillAlpha);
    expect(alpha(boundary + 1)).toBe(fillAlpha);
    expect(alpha(boundary + 39)).toBe(255);
    expect(alpha(boundary + 41)).toBe(0);
  });

  it('starts a range taller than the view right under the column header, at the last scroll offset', async () => {
    const view = await mount({ frozenColumns: 2 });
    const { scene, overlay } = view;
    const fillAlpha = rgba(lightTheme.selectionFill)[3];

    scene.setSelection({
      ...lastRows(0, 5),
      ranges: [
        {
          startRow: ROW_COUNT - 100,
          startCol: 0,
          endRow: ROW_COUNT - 1,
          endCol: 5,
        },
      ],
    });
    scene.setScroll(Number.MAX_SAFE_INTEGER, 0);
    await drawn();

    const { layout } = scene.state;
    const header = layout.headerHeight;

    // The header row above is the opaque highlight of the selected columns,
    // its frozen border redrawn along the bottom.
    for (const x of [layout.frozenBody.x + 60, layout.body.x + 60]) {
      expect(pixelAt(overlay, x, header - 1)).toEqual(
        rgba(lightTheme.frozenBorder)
      );
      expect(pixelAt(overlay, x, header)[3]).toBe(fillAlpha);
      expect(pixelAt(overlay, x, header + 1)[3]).toBe(fillAlpha);
    }
  });

  it('keeps a half scrolled column header highlight out of the frozen header', async () => {
    const view = await mount({ frozenColumns: 2 });
    const { scene, overlay } = view;
    const bounds = { rowCount: ROW_COUNT, colCount: COLUMNS.length };

    scene.setSelection(clickColumnHeader(scene.state.selection, 3, {}, bounds));
    scene.setScroll(0, 180);
    await drawn();

    const { layout } = scene.state;
    const boundary = layout.frozenBody.x + layout.frozenWidth;

    expect(pixelAt(overlay, boundary - 1, 4)[3]).toBe(0);
    expect(pixelAt(overlay, boundary + 1, 4)).toEqual(
      rgba(lightTheme.fullSelectionBackground)
    );
    expect(pixelAt(overlay, boundary - 30, 4)[3]).toBe(0);
  });
});

describe('a selected range', () => {
  it('draws its edge on the grid lines around it and leaves the active cell unfilled', async () => {
    const view = await mount();
    const { scene, overlay } = view;
    const fillAlpha = rgba(lightTheme.selectionFill)[3];
    const border = rgba(lightTheme.selectionBorder);
    const activeBorder = rgba(lightTheme.activeCellBorder);

    scene.setSelection({
      active: { row: 3, col: 3 },
      ranges: [{ startRow: 2, startCol: 2, endRow: 5, endCol: 4 }],
    });
    await drawn();

    const first = cellBox(scene, 2, 2);
    const last = cellBox(scene, 5, 4);
    const active = cellBox(scene, 3, 3);
    const midY = first.y + 10;
    const midX = first.x + 10;
    const right = last.x + last.width - 1;
    const bottom = last.y + last.height - 1;

    expect(pixelAt(overlay, first.x - 1, midY)).toEqual(border);
    expect(pixelAt(overlay, first.x - 2, midY)[3]).toBe(0);
    expect(pixelAt(overlay, first.x, midY)[3]).toBe(fillAlpha);
    expect(pixelAt(overlay, right, midY)).toEqual(border);
    expect(pixelAt(overlay, right + 1, midY)[3]).toBe(0);
    expect(pixelAt(overlay, midX, first.y - 1)).toEqual(border);
    expect(pixelAt(overlay, midX, first.y - 2)[3]).toBe(0);
    expect(pixelAt(overlay, midX, bottom)).toEqual(border);
    expect(pixelAt(overlay, midX, bottom + 1)[3]).toBe(0);

    expect(pixelAt(overlay, active.x - 1, active.y + 10)).toEqual(activeBorder);
    expect(pixelAt(overlay, active.x, active.y + 10)).toEqual(activeBorder);
    expect(colourAt(overlay, clearOfText(active))[3]).toBe(0);
    expect(colourAt(overlay, clearOfText(cellBox(scene, 2, 3)))[3]).toBe(
      fillAlpha
    );
    expect(colourAt(overlay, clearOfText(cellBox(scene, 3, 2)))[3]).toBe(
      fillAlpha
    );
    expect(colourAt(overlay, clearOfText(cellBox(scene, 3, 4)))[3]).toBe(
      fillAlpha
    );
    expect(colourAt(overlay, clearOfText(cellBox(scene, 4, 3)))[3]).toBe(
      fillAlpha
    );
  });

  it('fills nothing for one cell, which the active cell edge alone marks', async () => {
    const view = await mount();
    const { stage, scene, overlay } = view;

    scene.setSelection(selectCell({ row: 1, col: 1 }));
    await drawn();

    const cell = cellBox(scene, 1, 1);

    expect(stage.find('.grid-range-fill').every(node => !node.visible())).toBe(
      true
    );
    expect(pixelAt(overlay, cell.x - 1, cell.y + 10)).toEqual(
      rgba(lightTheme.activeCellBorder)
    );
    expect(colourAt(overlay, clearOfText(cell))[3]).toBe(0);
  });
});

describe('a selection that moves no rectangle', () => {
  it('still moves the column header highlight', async () => {
    const view = await mount();
    const { stage, scene, overlay } = view;
    const offscreen = (col: number): GridSelection => ({
      active: { row: 500_000, col },
      ranges: [
        { startRow: 500_000, startCol: col, endRow: 500_002, endCol: col },
      ],
    });
    const tint = rgba(lightTheme.selectedHeaderBackground);
    const rects = () =>
      stage
        .find('.grid-range, .grid-range-fill, .grid-active-cell')
        .map(node => ({ ...node.attrs }));

    scene.setSelection(offscreen(1));
    await drawn();

    const before = rects();
    expect(colourAt(overlay, clearOfLabel(columnHeaderBox(scene, 1)))).toEqual(
      tint
    );
    expect(before.every(attrs => attrs.visible === false)).toBe(true);

    scene.setSelection(offscreen(2));
    await drawn();

    expect(rects()).toEqual(before);
    expect(colourAt(overlay, clearOfLabel(columnHeaderBox(scene, 1)))[3]).toBe(
      0
    );
    expect(colourAt(overlay, clearOfLabel(columnHeaderBox(scene, 2)))).toEqual(
      tint
    );
  });
});

describe('a grid with no rows or no columns', () => {
  it('lights no header for the default selection, as it draws no box for it', async () => {
    for (const init of [{ rowCount: 0 }, { rowCount: 5, columns: [] }]) {
      const view = await mount(init);
      const { stage, scene, overlay } = view;
      const boxes = stage.find(
        '.grid-range, .grid-range-fill, .grid-active-cell'
      );

      expect(boxes.length).toBeGreaterThan(0);
      expect(boxes.every(node => !node.visible())).toBe(true);
      expect(
        colourAt(overlay, clearOfLabel(columnHeaderBox(scene, 0)))[3]
      ).toBe(0);
      expect(colourAt(overlay, clearOfLabel(rowHeaderBox(scene, 0)))[3]).toBe(
        0
      );
    }
  });
});

describe('a new size', () => {
  /** What the overlay's templates hold each time it draws, read as the draw begins. */
  function overlayDraws({ stage, overlay }: Mounted) {
    const draws: Array<{ track: number; clipWidth: number }> = [];

    overlay.on('beforeDraw.spec', () => {
      draws.push({
        track: stage.findOne('.grid-vertical-track')?.x() ?? Number.NaN,
        clipWidth: stage.findOne('.grid-body-clip')?.getAttr('clipWidth'),
      });
    });

    return draws;
  }

  it('reaches the stage after the templates, so its resize already draws the new regions', async () => {
    const view = await mount();
    const { stage, scene } = view;
    const draws = countGetters(view);
    const overlay = overlayDraws(view);
    await drawn();

    draws.length = 0;
    overlay.length = 0;
    scene.setSize(700.4, 400);
    await drawn();

    const { layout } = scene.state;

    expect(stage.size()).toEqual({ width: 700, height: 400 });
    expect(layout.width).toBe(700);
    expect(overlay.length).toBeGreaterThan(0);
    expect(overlay).toEqual(
      overlay.map(() => ({ track: 700 - 12, clipWidth: layout.body.width }))
    );
    expectWithin(draws, scene);
  });

  it('resizes the stage once when both axes change, and once when one does', async () => {
    const view = await mount();
    const { stage, scene } = view;
    const draws = countGetters(view);
    const overlay = overlayDraws(view);
    let resizes = 0;
    // Konva's Stage resizes its canvases and draws on each of these events.
    stage.on('widthChange.spec heightChange.spec', () => {
      resizes++;
    });
    await drawn();

    for (const [width, height] of [
      [700, 400],
      [700, 500],
      [800, 500],
    ]) {
      draws.length = 0;
      overlay.length = 0;
      resizes = 0;
      scene.setSize(width, height);
      await drawn();

      // The resize draws each layer once, and the commit's own frame draws
      // the layers its templates marked once more.
      expect(resizes).toBe(1);
      expect(draws).toHaveLength(2);
      expect(overlay).toHaveLength(2);
      expect(stage.size()).toEqual({ width, height });
    }
  });
});

describe('a pixel ratio of 2', () => {
  /** The two device pixels a stage pixel covers at a ratio of 2 along an axis, and the one before them. */
  function devicePixels(layer: Layer, x: number, y: number, axis = 'x') {
    const at = (step: number) =>
      axis === 'x' ? pixelAt(layer, x + step, y) : pixelAt(layer, x, y + step);

    return { before: at(-0.5), first: at(0), second: at(0.5) };
  }

  /** Mounts with konva's ratio at 2, as on a screen of that ratio, which konva reads as each canvas is made. */
  async function mountAtTwo(init: Partial<SceneInit>): Promise<Mounted> {
    const ratio = Konva.pixelRatio;
    Konva.pixelRatio = 2;

    try {
      return await mount(init);
    } finally {
      Konva.pixelRatio = ratio;
    }
  }

  it('lands every line, edge and label on the device pixels of its stage pixel', async () => {
    const calls = spyText();
    const view = await mountAtTwo({
      frozenColumns: 2,
      selection: {
        active: { row: 3, col: 3 },
        ranges: [{ startRow: 2, startCol: 3, endRow: 5, endCol: 4 }],
      },
    });
    const { scene, body, overlay } = view;
    const { layout, theme } = scene.state;
    const frozenEdge = layout.frozenBody.x + layout.frozenWidth - 1;
    const midBody = layout.body.y + layout.body.height / 2;
    const cell = cellBox(scene, 1, 3);
    const line = cell.x + cell.width - 1;
    const first = cellBox(scene, 2, 3);
    const active = cellBox(scene, 3, 3);
    const header = columnHeaderBox(scene, 3);
    const both = (colour: string) => ({
      first: rgba(colour),
      second: rgba(colour),
    });

    expect(body.getCanvas().getPixelRatio()).toBe(2);
    expect(overlay.getNativeCanvasElement().width).toBe(WIDTH * 2);

    expect(devicePixels(body, frozenEdge, midBody)).toEqual({
      before: rgba(theme.background),
      ...both(theme.frozenBorder),
    });
    expect(devicePixels(body, line, cell.y + 10)).toEqual({
      before: rgba(theme.background),
      ...both(theme.gridLine),
    });
    expect(
      devicePixels(body, header.x + 30, layout.headerHeight - 1, 'y')
    ).toEqual({
      before: rgba(theme.headerBackground),
      ...both(theme.frozenBorder),
    });

    const edge = devicePixels(overlay, first.x - 1, first.y + 10);
    expect(edge.before[3]).toBe(0);
    expect([edge.first, edge.second]).toEqual([
      rgba(theme.selectionBorder),
      rgba(theme.selectionBorder),
    ]);
    expect(pixelAt(overlay, first.x, first.y + 10)[3]).toBe(
      rgba(theme.selectionFill)[3]
    );

    const activeEdge = [-1, -0.5, 0, 0.5].map(dx =>
      pixelAt(overlay, active.x + dx, active.y + 10)
    );
    expect(activeEdge).toEqual(
      activeEdge.map(() => rgba(theme.activeCellBorder))
    );
    expect(pixelAt(overlay, active.x + 1, active.y + 10)[3]).toBe(0);

    expect(
      textsOn(calls, body)
        .filter(call => call.text === 'D')
        .map(call => call.x)
    ).toContain(header.x + header.width / 2);
  });
});

describe('the scrollbars', () => {
  it('paints both tracks and moves each thumb to its scroll offset', async () => {
    const view = await mount();
    const { scene, overlay } = view;
    const { layout } = scene.state;
    const { theme } = scene.state;

    expect(pixelAt(overlay, WIDTH - 1, 4)).toEqual(rgba(theme.scrollbarTrack));
    expect(pixelAt(overlay, WIDTH - 6, layout.body.y + 6)).toEqual(
      rgba(theme.scrollbarThumb)
    );
    expect(pixelAt(overlay, layout.body.x + 6, HEIGHT - 6)).toEqual(
      rgba(theme.scrollbarThumb)
    );
    expect(pixelAt(overlay, WIDTH - 6, HEIGHT - 6)).toEqual(
      rgba(theme.scrollbarTrack)
    );

    scene.setScroll(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    await drawn();

    expect(
      pixelAt(overlay, WIDTH - 6, layout.body.y + layout.body.height - 6)
    ).toEqual(rgba(theme.scrollbarThumb));
    expect(pixelAt(overlay, WIDTH - 6, layout.body.y + 6)).toEqual(
      rgba(theme.scrollbarTrack)
    );
    expect(
      pixelAt(overlay, layout.body.x + layout.body.width - 6, HEIGHT - 6)
    ).toEqual(rgba(theme.scrollbarThumb));
  });

  it('shows neither for content that fits, and draws no row past the last', async () => {
    const getCell = vi.fn(valueOf);
    const view = await mount({
      rowCount: 5,
      columns: COLUMNS.slice(0, 3),
      getCell,
    });
    const { stage, scene, body } = view;
    const { layout, theme } = scene.state;
    const below = cellBox(scene, 6, 1);

    expect(
      stage
        .find('.grid-vertical-track, .grid-horizontal-track')
        .map(node => node.visible())
    ).toEqual([false, false]);
    expect(getCell.mock.calls.every(([row, col]) => row < 5 && col < 3)).toBe(
      true
    );
    expect(colourAt(body, clearOfText(below))).toEqual(rgba(theme.background));
    expect(pixelAt(body, below.x + below.width - 1, below.y + 10)).toEqual(
      rgba(theme.background)
    );
    expect(layout.verticalBar || layout.horizontalBar).toBe(false);
  });
});

describe('pretext’s own caches', () => {
  /** Whether pretext measures a segment it met before with the canvas again, as it does once its caches are emptied. */
  function measuresAgain(segment: string) {
    const measureText = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'measureText'
    );
    prepareWithSegments(segment, DEFAULT_FONT);
    const again = measureText.mock.calls.some(([text]) => text === segment);
    measureText.mockRestore();

    return again;
  }

  it('are emptied once the distinct texts drawn outgrow the fitter’s bound, and no draw reads the DOM after', async () => {
    const view = await mount();
    const { scene, body } = view;
    const probe = 'zqxvw';
    let version = 0;
    // Each version draws a few hundred texts never seen before, an emoji
    // among them, so the segments pretext keeps pass the bound within a few
    // dozen versions, and an emoji calibration lost with them would show.
    scene.setGetters((row, col) =>
      version === 0 && row === 0 && col === 0
        ? `${probe} opens the first frame`
        : `version ${version} of row ${row} in column ${col} 😀`
    );
    await drawn();
    expect(measuresAgain(probe)).toBe(false);

    let drawing = false;
    body.on('beforeDraw.spec', () => {
      drawing = true;
    });
    body.on('draw.spec', () => {
      drawing = false;
    });
    const append = document.body.appendChild.bind(document.body);
    const appendedInDraw: boolean[] = [];
    vi.spyOn(document.body, 'appendChild').mockImplementation(node => {
      appendedInDraw.push(drawing);
      return append(node);
    });

    let emptied = false;
    for (version = 1; version <= 40 && !emptied; version++) {
      scene.setVersion(version);
      await drawn();
      emptied = measuresAgain(probe);
    }

    expect(emptied).toBe(true);
    expect(version).toBeGreaterThan(2);
    expect(appendedInDraw.some(inside => inside)).toBe(false);
  });
});

describe('an unmounted scene', () => {
  it('lets go of its layers and leaves the stage size alone', async () => {
    const view = await mount();
    const { stage, scene } = view;

    renderKonva(stage, null);
    await drawn();

    scene.setSize(500, 300);
    scene.setSelection(selectCell({ row: 1, col: 1 }));
    await drawn();

    expect(scene.layers).toEqual({ body: null, overlay: null });
    expect(stage.size()).toEqual({ width: WIDTH, height: HEIGHT });
  });
});
