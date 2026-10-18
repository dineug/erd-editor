import { observable } from '@dineug/r-html';
import { markDirty, requestFlush } from '@dineug/r-html-konva';
import type { Layer } from 'konva/lib/Layer';

import { DEFAULT_FONT, type FontMetrics, measureFont } from '@/font';
import { columnOffsets } from '@/model/columns';
import {
  type HeaderSelection,
  selectCell,
  selectedColumns,
  selectedRows,
} from '@/model/selection';
import { createTextFitter, type TextFitter } from '@/model/text';
import type { ColumnDef, GridBounds, GridSelection } from '@/model/types';
import {
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
  type Overscan,
  type VisibleRange,
  visibleRange,
} from '@/model/viewport';
import type { CellGetter, CellStyleGetter } from '@/scene/draw/cells';
import { computeLayout, type SceneLayout } from '@/scene/layout';
import { type GridTheme, lightTheme } from '@/theme';

/** A column resize in progress: the column and the width the pointer has dragged it to. */
export interface ColumnResize {
  col: number;
  width: number;
}

/** What a scene starts from; every field but the data has a default. */
export interface SceneInit {
  /** The stage's size, in CSS pixels. */
  width?: number;
  height?: number;
  rowCount: number;
  columns: readonly ColumnDef[];
  getCell: CellGetter;
  getCellStyle?: CellStyleGetter;
  frozenColumns?: number;
  rowHeight?: number;
  theme?: Readonly<GridTheme>;
  font?: string;
  version?: number;
  selection?: GridSelection;
}

/**
 * The state a scene draws from. A scene function reads this raw object and
 * never its observable proxy, whose reads cost a trap each; every write goes
 * through the proxy, so the templates bound to a field update with it.
 */
export interface SceneData {
  width: number;
  height: number;
  /** The scroll offsets in content pixels, scrollTop after the scroll mapping. */
  scrollTop: number;
  scrollLeft: number;
  rowCount: number;
  columns: readonly ColumnDef[];
  /** columnOffsets of the columns as drawn, a resize drag's width included. */
  offsets: readonly number[];
  frozenColumns: number;
  rowHeight: number;
  theme: Readonly<GridTheme>;
  font: string;
  metrics: FontMetrics;
  /** The widest digit of the font, which sizes the row-number header. */
  digitWidth: number;
  version: number;
  getCell: CellGetter;
  getCellStyle: CellStyleGetter | undefined;
  selection: GridSelection;
  resize: ColumnResize | null;
  layout: SceneLayout;
}

/** What one layer draw reads besides the state, settled once before its first shape. */
export interface SceneFrame {
  range: VisibleRange;
  /** The header cells the selection reaches, for the overlay's highlights. */
  rows: HeaderSelection;
  columns: HeaderSelection;
}

/** The two layers a mounted scene draws on. */
export interface SceneLayers {
  body: Layer | null;
  overlay: Layer | null;
}

/**
 * A grid's scene state and the one way to change it. Each setter marks the
 * layers its field draws on: the body takes the cells and headers, the
 * overlay the selection and scrollbars.
 */
export interface SceneState {
  /** The raw state, what the scene functions read. */
  readonly state: Readonly<SceneData>;
  /** The same state behind its observable proxy, what the templates read. */
  readonly observed: Readonly<SceneData>;
  readonly frame: Readonly<SceneFrame>;
  readonly fitter: TextFitter;
  readonly layers: Readonly<SceneLayers>;
  /** The cells the state shows, with the overscan given or the default one. */
  visibleRange(overscan?: Readonly<Overscan>): VisibleRange;
  /** Scrolls to content offsets, rounded to whole pixels and held to the scroll range. */
  setScroll(top: number, left: number): void;
  /** Resizes the scene to whole pixels; the stage follows at the next commit, after the templates. */
  setSize(width: number, height: number): void;
  setSelection(selection: GridSelection): void;
  setTheme(theme: Readonly<GridTheme>): void;
  setFont(font: string): void;
  setVersion(version: number): void;
  setColumns(columns: readonly ColumnDef[]): void;
  setRowCount(rowCount: number): void;
  setFrozenColumns(frozenColumns: number): void;
  setRowHeight(rowHeight: number): void;
  setGetters(getCell: CellGetter, getCellStyle?: CellStyleGetter): void;
  setResize(resize: ColumnResize | null): void;
  /** Hands the scene its layers and returns the unbinding; GridScene calls it at mount. */
  bindLayers(body: Layer, overlay: Layer): () => void;
  /** The size a commit still owes the stage, cleared by the read. */
  takePendingSize(): { width: number; height: number } | null;
}

const NO_HEADERS: HeaderSelection = Object.freeze({
  intersected: [],
  covered: [],
}) as HeaderSelection;

const digitWidths = new Map<string, number>();

/**
 * The widest of the ten digits in a font, measured once per font on a canvas
 * of its own. A realm with no canvas answers 0, which no cache keeps, and the
 * row-number header then takes its minimum width.
 */
function measureDigitWidth(font: string): number {
  const held = digitWidths.get(font);
  if (held !== undefined) return held;

  const context =
    typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d');
  if (!context) return 0;

  context.font = font;
  let width = 0;
  for (const digit of '0123456789') {
    width = Math.max(width, context.measureText(digit).width);
  }

  digitWidths.set(font, width);
  return width;
}

/**
 * A value the template can track. r-html's proxy subscribes to no frozen
 * object it reads, and the default themes are frozen, so a frozen one is
 * held as a shallow copy and a write of the next one still re-renders.
 */
const trackable = <T extends object>(value: T): T =>
  Object.isFrozen(value) ? { ...value } : value;

const wholeCount = (value: number) => Math.max(0, Math.floor(value) || 0);

/** A size on whole pixels, so every region edge and the scroll range land on one. */
const wholePixels = (value: number) => Math.max(0, Math.round(value) || 0);

const clamp = (value: number, max: number) =>
  Math.min(max, Math.max(0, Number.isFinite(value) ? Math.round(value) : 0));

/** The column offsets as drawn: the columns', with a resize drag's width in its column. */
function drawnOffsets(
  columns: readonly ColumnDef[],
  resize: ColumnResize | null
): number[] {
  if (!resize || !columns[resize.col]) return columnOffsets(columns);

  return columnOffsets(
    columns.map((column, index) =>
      index === resize.col ? { ...column, width: resize.width } : column
    )
  );
}

/**
 * A scene's state, which renderGridScene draws and a host changes through the
 * setters alone. The stage size is the host's to give: a size change reaches
 * the stage only at the commit that has redrawn the templates for it.
 *
 * @example
 * const scene = createSceneState({ rowCount, columns, getCell, width, height });
 * renderGridScene(stage, scene);
 * scene.setScroll(28 * 1000, 0);
 */
export function createSceneState(init: SceneInit): SceneState {
  const font = init.font ?? DEFAULT_FONT;
  const columns = init.columns;
  const offsets = drawnOffsets(columns, null);
  const rowCount = wholeCount(init.rowCount);
  const rowHeight =
    init.rowHeight !== undefined && init.rowHeight > 0
      ? init.rowHeight
      : DEFAULT_ROW_HEIGHT;
  const width = wholePixels(init.width ?? 0);
  const height = wholePixels(init.height ?? 0);
  const frozenColumns = init.frozenColumns ?? 0;
  const digitWidth = measureDigitWidth(font);

  const state: SceneData = {
    width,
    height,
    scrollTop: 0,
    scrollLeft: 0,
    rowCount,
    columns,
    offsets,
    frozenColumns,
    rowHeight,
    theme: trackable(init.theme ?? lightTheme),
    font,
    metrics: measureFont(font),
    digitWidth,
    version: init.version ?? 0,
    getCell: init.getCell,
    getCellStyle: init.getCellStyle,
    selection: trackable(init.selection ?? selectCell({ row: 0, col: 0 })),
    resize: null,
    layout: computeLayout({
      width,
      height,
      rowCount,
      rowHeight,
      offsets,
      frozenColumns,
      digitWidth,
    }),
  };
  // Shallow, since every field is replaced whole and none is changed in place:
  // a template read then hands back the raw value instead of a nested proxy.
  const observed = observable(state, { shallow: true });
  const fitter = createTextFitter();
  const layers: SceneLayers = { body: null, overlay: null };
  const frame: SceneFrame = {
    range: { rowStart: 0, rowEnd: -1, colStart: 0, colEnd: -1, frozenEnd: -1 },
    rows: NO_HEADERS,
    columns: NO_HEADERS,
  };
  let pendingSize: { width: number; height: number } | null = null;
  let themeSource = init.theme ?? lightTheme;
  let selectionSource = init.selection ?? state.selection;

  const mark = (body: boolean, overlay: boolean) => {
    if (body && layers.body) markDirty(layers.body);
    if (overlay && layers.overlay) markDirty(layers.overlay);
  };

  /** Places the regions again, and holds the scroll offsets to the range they leave. */
  const relayout = () => {
    const layout = computeLayout(state);
    observed.layout = layout;

    if (state.scrollTop > layout.maxScrollTop) {
      observed.scrollTop = layout.maxScrollTop;
    }
    if (state.scrollLeft > layout.maxScrollLeft) {
      observed.scrollLeft = layout.maxScrollLeft;
    }
  };

  const range = (overscan: Readonly<Overscan> = DEFAULT_OVERSCAN) =>
    visibleRange(
      state.scrollTop,
      state.scrollLeft,
      {
        width: state.layout.cellWidth,
        height: state.layout.cellHeight,
        rowCount: state.rowCount,
        frozenColumns: state.frozenColumns,
      },
      state.rowHeight,
      state.offsets,
      overscan
    );

  const bounds = (): GridBounds => ({
    rowCount: state.rowCount,
    colCount: state.columns.length,
  });

  /** Settles what a layer draw reads, and binds the fitter to this draw's font. */
  const beginFrame = (headers: boolean) => {
    const next = range();
    const rows = next.rowEnd - next.rowStart + 1;
    const cols = next.frozenEnd + 1 + next.colEnd - next.colStart + 1;

    frame.range = next;
    if (headers) {
      frame.rows = selectedRows(state.selection, bounds());
      frame.columns = selectedColumns(state.selection, bounds());
    }
    fitter.beginFrame(state.font, state.metrics.maxAdvance);
    fitter.reserve(rows * cols + cols);
  };

  return {
    state,
    observed,
    frame,
    fitter,
    layers,
    visibleRange: range,

    setScroll(top, left) {
      const nextTop = clamp(top, state.layout.maxScrollTop);
      const nextLeft = clamp(left, state.layout.maxScrollLeft);
      if (nextTop === state.scrollTop && nextLeft === state.scrollLeft) return;

      observed.scrollTop = nextTop;
      observed.scrollLeft = nextLeft;
      // The overlay follows through its scroll groups' x and y, which the
      // template writes, so only the body is marked here.
      mark(true, false);
    },

    setSize(sizeWidth, sizeHeight) {
      const nextWidth = wholePixels(sizeWidth);
      const nextHeight = wholePixels(sizeHeight);
      if (nextWidth === state.width && nextHeight === state.height) return;

      observed.width = nextWidth;
      observed.height = nextHeight;
      relayout();
      // The stage draws every layer at once when it resizes, so it waits for
      // the commit, by which the templates already hold the new regions.
      pendingSize = { width: nextWidth, height: nextHeight };
      requestFlush();
    },

    setSelection(selection) {
      if (selection !== selectionSource) {
        selectionSource = selection;
        observed.selection = trackable(selection);
      }
      // Always: a change that moves no rectangle, such as one off-screen range
      // for another, still moves the header highlight the overlay draws.
      mark(false, true);
    },

    setTheme(theme) {
      if (theme === themeSource) return;

      themeSource = theme;
      observed.theme = trackable(theme);
      mark(true, true);
    },

    setFont(nextFont) {
      if (nextFont === state.font) return;

      observed.font = nextFont;
      observed.metrics = measureFont(nextFont);
      observed.digitWidth = measureDigitWidth(nextFont);
      relayout();
      mark(true, true);
    },

    setVersion(version) {
      if (version === state.version) return;

      observed.version = version;
      mark(true, true);
    },

    setColumns(nextColumns) {
      if (nextColumns === state.columns) return;

      observed.columns = nextColumns;
      observed.offsets = drawnOffsets(nextColumns, state.resize);
      relayout();
      mark(true, true);
    },

    setRowCount(nextRowCount) {
      const count = wholeCount(nextRowCount);
      if (count === state.rowCount) return;

      observed.rowCount = count;
      relayout();
      mark(true, true);
    },

    setFrozenColumns(nextFrozen) {
      if (nextFrozen === state.frozenColumns) return;

      observed.frozenColumns = nextFrozen;
      relayout();
      mark(true, true);
    },

    setRowHeight(nextRowHeight) {
      if (!(nextRowHeight > 0) || nextRowHeight === state.rowHeight) return;

      observed.rowHeight = nextRowHeight;
      relayout();
      mark(true, true);
    },

    setGetters(getCell, getCellStyle) {
      if (getCell === state.getCell && getCellStyle === state.getCellStyle) {
        return;
      }

      observed.getCell = getCell;
      observed.getCellStyle = getCellStyle;
      // Only the cell regions read a getter.
      mark(true, false);
    },

    setResize(resize) {
      const held = state.resize;
      if (
        resize === held ||
        (resize &&
          held &&
          resize.col === held.col &&
          resize.width === held.width)
      ) {
        return;
      }

      observed.resize = resize;
      observed.offsets = drawnOffsets(state.columns, resize);
      relayout();
      mark(true, true);
    },

    bindLayers(body, overlay) {
      const beginBody = () => beginFrame(false);
      const beginOverlay = () => beginFrame(true);
      // A draw that ran out of measurements drew some texts whole under their
      // column clip, so the next frame measures the rest and cuts them.
      const finishBody = () => {
        if (fitter.hasDeferred()) markDirty(body);
      };
      const finishOverlay = () => {
        if (fitter.hasDeferred()) markDirty(overlay);
      };

      layers.body = body;
      layers.overlay = overlay;
      body.on('beforeDraw.grid', beginBody);
      body.on('draw.grid', finishBody);
      overlay.on('beforeDraw.grid', beginOverlay);
      overlay.on('draw.grid', finishOverlay);

      return () => {
        body.off('beforeDraw.grid draw.grid');
        overlay.off('beforeDraw.grid draw.grid');
        if (layers.body === body) layers.body = null;
        if (layers.overlay === overlay) layers.overlay = null;
      };
    },

    takePendingSize() {
      const size = pendingSize;
      pendingSize = null;
      return size;
    },
  };
}
