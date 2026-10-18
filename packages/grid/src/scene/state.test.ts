// The scene state on its own: the defaults, what each setter writes, and the
// layers it marks, with the draw gate stood in for so each mark is counted.
// GridScene.browser.test.tsx draws the same state on a real stage.

import { nextTick, observer } from '@dineug/r-html';
import type { Layer } from 'konva/lib/Layer';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { DEFAULT_FONT } from '@/font';
import { columnOffsets } from '@/model/columns';
import { selectCell } from '@/model/selection';
import type { ColumnDef, GridSelection } from '@/model/types';
import { DEFAULT_ROW_HEIGHT } from '@/model/viewport';
import { createSceneState, type SceneState } from '@/scene/state';
import { darkTheme, lightTheme } from '@/theme';

const gate = vi.hoisted(() => ({
  markDirty: vi.fn(),
  requestFlush: vi.fn(),
}));

vi.mock('@dineug/r-html-konva', () => gate);

const COLUMNS: ColumnDef[] = Array.from({ length: 20 }, (_, index) => ({
  id: `c${index}`,
  label: `${index}`,
}));

const FEW_COLUMNS = COLUMNS.slice(0, 5);

const constant = () => 'x';

type Handler = () => void;

/** A layer that keeps the handlers bound to it, by event and namespace. */
function fakeLayer() {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    fire: (name: string) => handlers.get(name)?.(),
    layer: {
      on: (name: string, handler: Handler) => handlers.set(name, handler),
      off: (names: string) =>
        names.split(' ').forEach(name => handlers.delete(name)),
    } as unknown as Layer,
  };
}

function bound(scene: SceneState) {
  const body = fakeLayer();
  const overlay = fakeLayer();
  const unbind = scene.bindLayers(body.layer, overlay.layer);

  return { body, overlay, unbind };
}

const create = (overrides = {}) =>
  createSceneState({
    rowCount: 1_000_000,
    columns: COLUMNS,
    getCell: (row, col) => `${row}:${col}`,
    width: 800,
    height: 600,
    ...overrides,
  });

/** The layers marked since the last clear, by which fake they were. */
function marked(body: Layer, overlay: Layer) {
  return gate.markDirty.mock.calls.map(([layer]) =>
    layer === body ? 'body' : layer === overlay ? 'overlay' : 'other'
  );
}

beforeEach(() => {
  gate.markDirty.mockClear();
  gate.requestFlush.mockClear();
});

describe('createSceneState', () => {
  it('starts from the defaults around the data it is given', () => {
    const scene = createSceneState({
      rowCount: 12.7,
      columns: COLUMNS,
      getCell: () => '',
      rowHeight: 0,
    });
    const { state } = scene;

    expect(state.rowCount).toBe(12);
    expect(state.rowHeight).toBe(DEFAULT_ROW_HEIGHT);
    expect(state.font).toBe(DEFAULT_FONT);
    expect(state.theme).toEqual(lightTheme);
    expect(state.selection).toEqual(selectCell({ row: 0, col: 0 }));
    expect(state.offsets).toEqual(columnOffsets(COLUMNS));
    expect(state.version).toBe(0);
    expect(state.width).toBe(0);
    expect(state.resize).toBeNull();
    expect(scene.layers).toEqual({ body: null, overlay: null });
    // happy-dom has no canvas, so no digit is measured and the row-number
    // header keeps its minimum.
    expect(state.digitWidth).toBe(0);
    expect(state.layout.rowHeaderWidth).toBe(40);
  });

  it('keeps what it is given and rounds the stage size to whole pixels', () => {
    const selection = selectCell({ row: 3, col: 4 });
    const scene = create({
      width: 640.6,
      height: Number.NaN,
      theme: { ...darkTheme },
      font: '15px serif',
      version: 7,
      rowHeight: 30,
      frozenColumns: 2,
      selection,
    });
    const { state } = scene;

    expect(state.width).toBe(641);
    expect(state.height).toBe(0);
    expect(state.theme).toEqual(darkTheme);
    expect(state.font).toBe('15px serif');
    expect(state.version).toBe(7);
    expect(state.rowHeight).toBe(30);
    expect(state.selection).toBe(selection);
    expect(state.layout.frozenCount).toBe(2);
  });

  it('answers the visible range with the default overscan, or the one given', () => {
    const scene = create();

    // The cell area is 748 by 560: twenty rows and seven columns, the last
    // one cut by the vertical scrollbar's strip.
    expect(scene.visibleRange()).toEqual({
      rowStart: 0,
      rowEnd: 21,
      colStart: 0,
      colEnd: 7,
      frozenEnd: -1,
    });
    expect(scene.visibleRange({ rows: 0, cols: 0 })).toEqual({
      rowStart: 0,
      rowEnd: 19,
      colStart: 0,
      colEnd: 6,
      frozenEnd: -1,
    });
  });
});

describe('each setter marks the layers its field draws on', () => {
  const cases: Array<[string, (scene: SceneState) => void, string[]]> = [
    ['scroll', scene => scene.setScroll(100, 50), ['body']],
    ['theme', scene => scene.setTheme(darkTheme), ['body', 'overlay']],
    ['font', scene => scene.setFont('14px serif'), ['body', 'overlay']],
    ['version', scene => scene.setVersion(1), ['body', 'overlay']],
    ['columns', scene => scene.setColumns(FEW_COLUMNS), ['body', 'overlay']],
    ['row count', scene => scene.setRowCount(10), ['body', 'overlay']],
    ['frozen columns', scene => scene.setFrozenColumns(1), ['body', 'overlay']],
    ['row height', scene => scene.setRowHeight(30), ['body', 'overlay']],
    [
      'resize drag',
      scene => scene.setResize({ col: 0, width: 200 }),
      ['body', 'overlay'],
    ],
    ['getters', scene => scene.setGetters(constant), ['body']],
    [
      'selection',
      scene => scene.setSelection(selectCell({ row: 1, col: 1 })),
      ['overlay'],
    ],
    ['size', scene => scene.setSize(500, 400), []],
  ];

  it.each(cases)('%s', (_, change, layers) => {
    const scene = create();
    const { body, overlay } = bound(scene);

    change(scene);

    expect(marked(body.layer, overlay.layer)).toEqual(layers);
  });

  it.each(cases.filter(([name]) => name !== 'selection'))(
    'nothing for the same %s again',
    (_, change) => {
      const scene = create();
      const { body, overlay } = bound(scene);

      change(scene);
      gate.markDirty.mockClear();
      change(scene);

      expect(marked(body.layer, overlay.layer)).toEqual([]);
    }
  );

  it('the overlay for the same selection again, which can move a header highlight', () => {
    const scene = create();
    const { body, overlay } = bound(scene);
    const selection = selectCell({ row: 2, col: 2 });

    scene.setSelection(selection);
    scene.setSelection(selection);

    expect(marked(body.layer, overlay.layer)).toEqual(['overlay', 'overlay']);
    expect(scene.state.selection).toBe(selection);
  });

  it('nothing before layers are bound, and nothing after they are let go', () => {
    const scene = create();

    scene.setTheme(darkTheme);
    const { unbind } = bound(scene);
    unbind();
    scene.setVersion(3);

    expect(gate.markDirty).not.toHaveBeenCalled();
    expect(scene.layers).toEqual({ body: null, overlay: null });
  });
});

describe('the fields a setter writes', () => {
  it('rounds the scroll to whole pixels and holds it to the scroll range', () => {
    const scene = create();
    const { maxScrollTop, maxScrollLeft } = scene.state.layout;

    scene.setScroll(100.4, 49.6);
    expect([scene.state.scrollTop, scene.state.scrollLeft]).toEqual([100, 50]);

    scene.setScroll(Infinity, 1e9);
    expect([scene.state.scrollTop, scene.state.scrollLeft]).toEqual([
      0,
      maxScrollLeft,
    ]);

    scene.setScroll(1e12, -5);
    expect([scene.state.scrollTop, scene.state.scrollLeft]).toEqual([
      maxScrollTop,
      0,
    ]);
  });

  it('owes the stage a new size once, arms the gate, and pulls the scroll back into range', () => {
    const scene = create();

    scene.setScroll(1e12, 1e12);
    scene.setSize(1200.5, 300);

    expect(scene.state.layout.width).toBe(1201);
    expect(scene.state.scrollLeft).toBe(scene.state.layout.maxScrollLeft);
    expect(gate.requestFlush).toHaveBeenCalledTimes(1);
    expect(scene.takePendingSize()).toEqual({ width: 1201, height: 300 });
    expect(scene.takePendingSize()).toBeNull();

    scene.setRowCount(3);
    expect(scene.state.scrollTop).toBe(0);
  });

  it('measures a new font and places the regions for it', () => {
    const scene = create();

    scene.setFont('20px serif');

    expect(scene.state.font).toBe('20px serif');
    expect(scene.state.metrics).toEqual({
      ascent: 0,
      descent: 0,
      maxAdvance: 0,
    });
    expect(scene.state.layout.rowHeaderWidth).toBe(40);
  });

  it('draws a resize drag in its column alone, and the columns again when it ends', () => {
    const scene = create();

    scene.setResize({ col: 1, width: 300 });
    expect(scene.state.offsets.slice(0, 4)).toEqual([0, 120, 420, 540]);
    expect(scene.state.layout.contentWidth).toBe(19 * 120 + 300);

    scene.setResize({ col: 1, width: 300 });
    scene.setResize({ col: 1, width: 10 });
    expect(scene.state.offsets[2]).toBe(144);

    scene.setColumns(COLUMNS.slice(0, 3));
    expect(scene.state.offsets).toEqual([0, 120, 144, 264]);

    scene.setResize({ col: 9, width: 400 });
    expect(scene.state.offsets).toEqual(columnOffsets(COLUMNS.slice(0, 3)));

    scene.setResize(null);
    expect(scene.state.offsets).toEqual(columnOffsets(COLUMNS.slice(0, 3)));
  });

  it('keeps the row height for one that is no height', () => {
    const scene = create();

    scene.setRowHeight(0);
    scene.setRowHeight(Number.NaN);

    expect(scene.state.rowHeight).toBe(DEFAULT_ROW_HEIGHT);
  });

  it('swaps a getter alone and keeps the other', () => {
    const scene = create();
    const style = () => ({ background: 'red' });
    const cell = () => 'x';

    scene.setGetters(scene.state.getCell, style);
    expect(scene.state.getCellStyle).toBe(style);

    scene.setGetters(cell, style);
    expect(scene.state.getCell).toBe(cell);
  });
});

describe('what the templates track', () => {
  it('re-renders for a frozen theme and a frozen selection, which the proxy would not track', async () => {
    const scene = create();
    const seen: string[] = [];
    const stop = observer(() => {
      seen.push(
        `${scene.observed.theme.background} ${scene.observed.selection.active.row}`
      );
    });
    const frozen: GridSelection = Object.freeze(selectCell({ row: 9, col: 0 }));

    scene.setTheme(darkTheme);
    await nextTick(() => {});
    scene.setSelection(frozen);
    await nextTick(() => {});
    stop();

    expect(seen).toEqual([
      `${lightTheme.background} 0`,
      `${darkTheme.background} 0`,
      `${darkTheme.background} 9`,
    ]);
    expect(scene.state.selection).toEqual(frozen);
  });
});

describe('a layer draw', () => {
  it('settles the visible range and binds the fitter before the body draws', () => {
    const scene = create();
    const { body } = bound(scene);
    const beginFrame = vi.spyOn(scene.fitter, 'beginFrame');
    const reserve = vi.spyOn(scene.fitter, 'reserve');

    scene.setScroll(28 * 100, 0);
    body.fire('beforeDraw.grid');

    expect(scene.frame.range).toEqual(scene.visibleRange());
    expect(beginFrame).toHaveBeenCalledWith(DEFAULT_FONT, 0);
    expect(reserve).toHaveBeenCalledWith(24 * 8 + 8);
  });

  it('reads the header cells the selection reaches before the overlay draws', () => {
    const scene = create();
    const { overlay } = bound(scene);

    scene.setSelection({
      active: { row: 0, col: 2 },
      ranges: [{ startRow: 0, startCol: 2, endRow: 999_999, endCol: 3 }],
    });
    overlay.fire('beforeDraw.grid');

    expect(scene.frame.columns).toEqual({
      intersected: [{ start: 2, end: 3 }],
      covered: [{ start: 2, end: 3 }],
    });
    expect(scene.frame.rows).toEqual({
      intersected: [{ start: 0, end: 999_999 }],
      covered: [],
    });
  });

  it('asks its layer for another frame when it left a text unmeasured', () => {
    const scene = create();
    const { body, overlay } = bound(scene);
    const deferred = vi.spyOn(scene.fitter, 'hasDeferred');

    deferred.mockReturnValue(false);
    body.fire('draw.grid');
    overlay.fire('draw.grid');
    expect(gate.markDirty).not.toHaveBeenCalled();

    deferred.mockReturnValue(true);
    body.fire('draw.grid');
    overlay.fire('draw.grid');
    expect(marked(body.layer, overlay.layer)).toEqual(['body', 'overlay']);
  });

  it('unbinds every handler it bound', () => {
    const scene = create();
    const { body, overlay, unbind } = bound(scene);

    expect([...body.handlers.keys()]).toEqual(['beforeDraw.grid', 'draw.grid']);
    unbind();

    expect(body.handlers.size + overlay.handlers.size).toBe(0);
  });
});
