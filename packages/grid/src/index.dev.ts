import { markDirty, renderKonva, whenDrawn } from '@dineug/r-html-konva';
import type { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';

import { clickColumnHeader, selectCell, spanOf } from '@/model/selection';
import type {
  CellRef,
  CellStyle,
  ColumnDef,
  GridSelection,
} from '@/model/types';
import { scrollMapping } from '@/model/viewport';
import { renderGridScene } from '@/scene/GridScene';
import { createSceneState, type SceneState } from '@/scene/state';
import { darkTheme, type GridTheme, lightTheme } from '@/theme';

const ROW_COUNT = 1_000_000;

const COLUMN_COUNT = 30;

/**
 * How far each version bump moves the rows the strings are made from. Every
 * string a cell measures repeats only past hundreds of rows, so the cache holds
 * none a bump brings into view.
 */
const VERSION_SHIFT = 7919;

/** A bench run's page fills the window with the grid alone, the size the bench reports at. */
const BENCH = new URLSearchParams(location.search).has('bench');

const columnLabel = (index: number) =>
  String.fromCharCode(65 + (index % 26)).repeat(Math.floor(index / 26) + 1);

const COLUMNS: ColumnDef[] = Array.from(
  { length: COLUMN_COUNT },
  (_, index) => ({
    id: `c${index}`,
    label: columnLabel(index),
    readonly: index === 0 ? true : undefined,
  })
);

const FIRST_NAMES = [
  'Alice',
  'Bruno',
  'Chloé',
  'Dmitri',
  'Eun-ji',
  'Farah',
  'Gustavo',
  'Hiroshi',
  'Inès',
  'Jamal',
  'Kenji',
  'Lena',
  'Mateo',
  'Nadia',
  'Oskar',
  'Priya',
];

const LAST_NAMES = [
  'Kim',
  'Okafor',
  'Novak',
  'García',
  'Tanaka',
  'Müller',
  'Silva',
  'Haddad',
  'Larsen',
  'Chen',
  'Rossi',
  'Dubois',
];

const PLACES = [
  '서울특별시 강남구 테헤란로',
  '부산광역시 해운대구 우동',
  '대구광역시 수성구 범어동',
  '인천광역시 연수구 송도동',
  '광주광역시 북구 용봉동',
  '대전광역시 유성구 궁동',
  '제주특별자치도 제주시 연동',
  '경기도 성남시 분당구 정자동',
];

const TAGS = [
  '🍎 사과',
  '🚀 배포 완료',
  '✅ 검토됨',
  '🔥 긴급',
  '📦 출고 대기',
  '🌧️ 보류',
  '👍 승인',
  '🐛 버그',
];

const WORDS =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi'.split(
    ' '
  );

const grouped = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const pad = (value: number) => (value < 10 ? `0${value}` : String(value));

function sentence(seed: number, length: number): string {
  let text = WORDS[seed % WORDS.length];
  for (let index = 1; index < length; index++) {
    text += ` ${WORDS[(seed + index * 5) % WORDS.length]}`;
  }

  return text;
}

/** How many times the data has changed; it only grows, so a bump never brings back a string the cache still holds. */
let generation = 0;

/** The getCell calls since the bench last read them, which is the cells the scene drew. */
let cellReads = 0;

/**
 * The display string of a cell, decided by its indices and the generation:
 * ten kinds of value repeat across the columns, from row numbers to long
 * sentences that need an ellipsis, Hangul, emoji and cells left empty.
 */
function valueAt(row: number, col: number): string {
  const r = row + generation * VERSION_SHIFT;

  switch (col % 10) {
    case 0:
      return col === 0 ? `#${r + 1}` : `SKU-${(r * 31 + col) % 1_000_000}`;
    case 1:
      return r % 11 === 0
        ? ''
        : `${FIRST_NAMES[(r + col) % FIRST_NAMES.length]} ${LAST_NAMES[(r * 7 + col) % LAST_NAMES.length]} ${r % 1000}`;
    case 2:
      return `${PLACES[(r + col) % PLACES.length]} ${(r % 997) + 1}`;
    case 3:
      return `${TAGS[(r * 3 + col) % TAGS.length]} ${r % 1000}`;
    case 4:
      return `${r}. ${sentence(r * 7 + col, 6 + (r % 9))}`;
    case 5: {
      const cents = (r * 7919 + col * 104_729) % 100_000_000;

      return `${grouped(Math.floor(cents / 100))}.${pad(cents % 100)}`;
    }
    case 6: {
      const day = (r * 37 + col) % 3650;

      return `${2016 + Math.floor(day / 365)}-${pad(Math.floor((day % 365) / 31) + 1)}-${pad((day % 28) + 1)} ${pad(r % 24)}:${pad((r * 7) % 60)}`;
    }
    case 7:
      return r % 3 === 0 ? `${WORDS[r % WORDS.length]} ${r % 1000}` : '';
    case 8:
      return (r * 7 + col) % 3 === 0 ? 'FALSE' : 'TRUE';
    default:
      return `${FIRST_NAMES[(r + col) % FIRST_NAMES.length].toLowerCase()}.${r % 1000}@example.com`;
  }
}

/** The getter the scene reads, which counts its calls; the style hook reads valueAt, so only the drawn cells count. */
function getCell(row: number, col: number): string {
  cellReads++;

  return valueAt(row, col);
}

const LIGHT_STYLES = {
  yes: Object.freeze({ color: '#188038' }),
  no: Object.freeze({ color: '#c5221f' }),
};

const DARK_STYLES = {
  yes: Object.freeze({ color: '#81c995' }),
  no: Object.freeze({ color: '#f28b82' }),
};

const READONLY: CellStyle = Object.freeze({ readonly: true });

let theme: Readonly<GridTheme> = matchMedia('(prefers-color-scheme: dark)')
  .matches
  ? darkTheme
  : lightTheme;

/** The style hook: a colour on the TRUE and FALSE columns, and a read-only amount now and then. */
function getCellStyle(row: number, col: number): CellStyle | undefined {
  const kind = col % 10;

  if (kind === 8) {
    const styles = theme === darkTheme ? DARK_STYLES : LIGHT_STYLES;

    return valueAt(row, col) === 'TRUE' ? styles.yes : styles.no;
  }
  if (kind === 5 && row % 17 === 0) return READONLY;

  return undefined;
}

const style = document.createElement('style');
style.textContent = `
  html, body { height: 100%; margin: 0; }
  body {
    display: flex;
    flex-direction: column;
    background: var(--grid-background);
    color: var(--grid-text);
    font: 13px system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 8px 16px;
    background: var(--grid-header);
    border-bottom: 1px solid var(--grid-border);
    color: var(--grid-header-text);
  }
  .toolbar h1 { margin: 0; font-size: 14px; font-weight: 600; color: var(--grid-text); }
  .toolbar .size { opacity: 0.75; }
  .group { display: flex; align-items: center; gap: 4px; }
  .group > span { margin-right: 4px; }
  .toolbar button, .toolbar input {
    font: inherit;
    color: var(--grid-text);
    background: var(--grid-background);
    border: 1px solid var(--grid-border);
    border-radius: 6px;
    padding: 4px 10px;
  }
  .toolbar button { cursor: pointer; }
  .toolbar button[aria-pressed='true'] {
    border-color: var(--grid-accent);
    color: var(--grid-accent);
  }
  .toolbar input { width: 96px; }
  .grid { position: relative; flex: 1; min-height: 0; overflow: hidden; }
`;
document.head.append(style);

const toolbar = document.createElement('header');
toolbar.className = 'toolbar';

const container = document.createElement('div');
container.className = 'grid';

document.body.append(...(BENCH ? [container] : [toolbar, container]));

function paintPage() {
  const root = document.documentElement.style;

  root.setProperty('--grid-background', theme.background);
  root.setProperty('--grid-header', theme.headerBackground);
  root.setProperty('--grid-header-text', theme.headerText);
  root.setProperty('--grid-text', theme.text);
  root.setProperty('--grid-border', theme.frozenBorder);
  root.setProperty('--grid-accent', theme.selectionBorder);
  root.colorScheme = theme === darkTheme ? 'dark' : 'light';
}

let stage: Stage | null = null;
let scene: SceneState | null = null;

/** The Konva layers' draw time and count since the bench last read them. */
const pending = { drawMs: 0, draws: 0 };

/**
 * Times every layer draw: the scene canvas, its clear, the hit canvas sync and
 * its clear, the span konva runs in the animation frame batchDraw books. The
 * layer class is found through a layer, so nothing here constructs one.
 */
function timeLayerDraws(layer: Layer) {
  const prototype = Object.getPrototypeOf(layer) as Layer & {
    __benchTimed?: true;
  };
  if (prototype.__benchTimed) return;

  const draw = prototype.draw;
  prototype.__benchTimed = true;
  prototype.draw = function (this: Layer) {
    const start = performance.now();
    try {
      return draw.call(this);
    } finally {
      pending.drawMs += performance.now() - start;
      pending.draws++;
    }
  };
}

/** Draws each layer at the screen's pixel ratio, which konva read once when it loaded. */
function matchPixelRatio() {
  const ratio = window.devicePixelRatio || 1;

  for (const layer of stage?.getLayers() ?? []) {
    if (layer.getCanvas().getPixelRatio() === ratio) continue;

    layer.getCanvas().setPixelRatio(ratio);
    markDirty(layer);
  }
}

function watchPixelRatio() {
  matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`
  ).addEventListener(
    'change',
    () => {
      matchPixelRatio();
      watchPixelRatio();
    },
    { once: true }
  );
}

const nextFrame = () =>
  new Promise<number>(resolve => {
    requestAnimationFrame(resolve);
  });

/** One mount, timed from the scene's creation to the first frame after the first commit. */
export interface FirstDraw {
  /** From creating the scene to the frame that follows its first whenDrawn, waits included. */
  wallMs: number;
  /** The scene's creation and render, the commit and the layer draws: the work in that span. */
  workMs: number;
  cells: number;
}

async function mount(): Promise<FirstDraw> {
  const previous = scene?.state;
  const start = performance.now();
  const rect = container.getBoundingClientRect();

  pending.drawMs = 0;
  pending.draws = 0;
  cellReads = 0;

  stage = new Stage({
    container,
    width: rect.width,
    height: rect.height,
    listening: false,
  });
  scene = createSceneState({
    width: rect.width,
    height: rect.height,
    rowCount: ROW_COUNT,
    columns: COLUMNS,
    getCell,
    getCellStyle,
    frozenColumns: previous?.frozenColumns,
    theme,
    version: generation,
    selection: previous?.selection,
  });
  renderGridScene(stage, scene);
  await whenDrawn();
  const committed = performance.now();

  // The host attaches the layers to the stage at the commit, and konva draws
  // them on the next animation frame, so this is the last point before it.
  const body = stage.findOne<Layer>('.grid-body');
  if (body) timeLayerDraws(body);
  matchPixelRatio();
  await nextFrame();

  return {
    wallMs: performance.now() - start,
    workMs: committed - start + pending.drawMs,
    cells: cellReads,
  };
}

function unmount() {
  if (!stage) return;

  renderKonva(stage, null);
  stage.destroy();
  stage = null;
}

new ResizeObserver(() => {
  const rect = container.getBoundingClientRect();
  scene?.setSize(rect.width, rect.height);
}).observe(container);

/** Content pixels per DOM pixel of scroll: the scroll mapping's ratio, which a DOM scroller over these rows scales by. */
const verticalRatio = () =>
  scene ? scrollMapping(scene.state.layout.contentHeight).ratio : 1;

container.addEventListener(
  'wheel',
  event => {
    if (!scene) return;
    event.preventDefault();

    const { rowHeight, layout, scrollTop, scrollLeft } = scene.state;
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? rowHeight
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? layout.cellHeight
          : 1;
    const sideways = event.shiftKey && event.deltaX === 0;
    const dy = sideways ? 0 : event.deltaY * unit;
    const dx = (sideways ? event.deltaY : event.deltaX) * unit;

    scene.setScroll(scrollTop + dy * verticalRatio(), scrollLeft + dx);
  },
  { passive: false }
);

const bounds = () => ({ rowCount: ROW_COUNT, colCount: COLUMN_COUNT });

/** A selection placed against the first row and column in view, so a preset lands on screen. */
function preset(kind: string): GridSelection {
  const view = scene!.visibleRange({ rows: 0, cols: 0 });
  const row = Math.max(0, view.rowStart);
  const col = view.frozenEnd >= 0 ? 0 : view.colStart;
  const at = (dr: number, dc: number): CellRef => ({
    row: Math.min(ROW_COUNT - 1, row + dr),
    col: Math.min(COLUMN_COUNT - 1, col + dc),
  });

  switch (kind) {
    case 'range':
      return { active: at(2, 1), ranges: [spanOf(at(2, 1), at(7, 3))] };
    case 'ranges':
      return {
        active: at(7, 2),
        ranges: [
          spanOf(at(1, 1), at(4, 2)),
          spanOf(at(3, 4), at(8, 5)),
          spanOf(at(7, 2), at(10, 4)),
        ],
      };
    case 'column':
      return clickColumnHeader(
        selectCell(at(0, 3)),
        at(0, 3).col,
        {},
        bounds()
      );
    default:
      return selectCell(at(2, 1));
  }
}

/** A group of toolbar buttons where one choice is pressed at a time. */
function choices(
  label: string,
  options: Array<[string, string]>,
  pressed: string | null,
  choose: (value: string) => void
) {
  const group = document.createElement('div');
  const caption = document.createElement('span');
  group.className = 'group';
  caption.textContent = label;
  group.append(caption);

  const buttons = options.map(([value, text]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.dataset.value = value;
    button.setAttribute('aria-pressed', String(value === pressed));
    button.addEventListener('click', () => {
      if (pressed !== null) {
        buttons.forEach(other =>
          other.setAttribute('aria-pressed', String(other === button))
        );
      }
      choose(value);
    });

    return button;
  });

  group.append(...buttons);
  return group;
}

function buildToolbar() {
  const title = document.createElement('h1');
  const size = document.createElement('span');
  title.textContent = '@dineug/grid';
  size.className = 'size';
  size.textContent = `${grouped(ROW_COUNT)} rows × ${COLUMN_COUNT} columns`;

  const goTo = document.createElement('input');
  goTo.type = 'number';
  goTo.min = '1';
  goTo.max = String(ROW_COUNT);
  goTo.placeholder = 'Go to row';
  goTo.setAttribute('aria-label', 'Go to row');
  goTo.addEventListener('change', () => {
    const row = Math.min(ROW_COUNT, Math.max(1, Number(goTo.value) || 1)) - 1;
    scene?.setScroll(row * scene.state.rowHeight, scene.state.scrollLeft);
  });

  const bump = document.createElement('button');
  bump.type = 'button';
  bump.textContent = 'New data';
  bump.addEventListener('click', () => {
    generation++;
    scene?.setVersion(generation);
  });

  toolbar.append(
    title,
    size,
    choices(
      'Theme',
      [
        ['light', 'Light'],
        ['dark', 'Dark'],
      ],
      theme === darkTheme ? 'dark' : 'light',
      value => {
        theme = value === 'dark' ? darkTheme : lightTheme;
        paintPage();
        scene?.setTheme(theme);
      }
    ),
    choices(
      'Frozen',
      [
        ['0', 'None'],
        ['2', '2 columns'],
      ],
      '0',
      value => scene?.setFrozenColumns(Number(value))
    ),
    choices(
      'Select',
      [
        ['cell', 'Cell'],
        ['range', 'One range'],
        ['ranges', 'Several ranges'],
        ['column', 'Full column'],
      ],
      null,
      value => scene?.setSelection(preset(value))
    ),
    bump,
    goTo
  );
}

/** One animation frame's main-thread work, as the bench reads it back. */
export interface FrameSample {
  /** The frame's requestAnimationFrame timestamp. */
  time: number;
  /** Konva layer draws in the frame. */
  drawMs: number;
  draws: number;
  /** The state writes of the frame's scroll, jump or version bump. */
  scrollMs: number;
  /** From those writes to whenDrawn: the template drain and the commit that marks the layers. */
  flushMs: number;
  /** getCell calls in the frame, one per cell the body drew. */
  cells: number;
}

/** What the bench drives one step of per frame. */
export type Scenario =
  | { kind: 'idle' }
  | { kind: 'step'; domPx: number }
  | { kind: 'jump'; seed: number }
  | { kind: 'version' };

export interface BenchInfo {
  /** Whether the page is cross-origin isolated, which narrows performance.now from 100 microseconds to 5. */
  isolated: boolean;
  devicePixelRatio: number;
  canvasPixelRatio: number;
  width: number;
  height: number;
  rowCount: number;
  columnCount: number;
  /** Content pixels a DOM pixel of scroll moves. */
  scrollRatio: number;
  /** The cells in view, with no overscan, at the current scroll offsets. */
  visibleCells: number;
}

/** The page's bench hooks, which only this demo installs. */
export interface GridBench {
  firstDraw: FirstDraw | null;
  /** Unmounts the scene and mounts a new one, timed as firstDraw is. */
  remount(): Promise<FirstDraw>;
  /** Scrolls by DOM pixels down and right, as a wheel would, and waits for the commit. */
  scrollBy(domTop: number, left?: number): Promise<void>;
  jumpToRow(row: number, left?: number): Promise<void>;
  /** Moves the rows every string is made from, so the cache holds none in view, and bumps the version. */
  bumpVersion(): Promise<void>;
  /** Runs one step of a scenario per frame, frames times, and returns each frame's sample. */
  run(scenario: Scenario, frames: number): Promise<FrameSample[]>;
  /** The samples of the last run. */
  samples(): FrameSample[];
  info(): BenchInfo;
}

declare global {
  interface Window {
    __gridBench?: GridBench;
  }
}

/** A seeded generator, so two runs jump through the same rows. */
function random(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function stepOf(scenario: Scenario): () => void {
  const current = scene!;

  switch (scenario.kind) {
    case 'step':
      return () =>
        current.setScroll(
          current.state.scrollTop + scenario.domPx * verticalRatio(),
          current.state.scrollLeft
        );
    case 'jump': {
      const next = random(scenario.seed);

      return () => {
        const { layout, rowHeight } = current.state;
        current.setScroll(
          Math.floor(next() * ROW_COUNT) * rowHeight,
          Math.floor(next() * layout.maxScrollLeft)
        );
      };
    }
    case 'version':
      return () => {
        generation++;
        current.setVersion(generation);
      };
    default:
      return () => {};
  }
}

let lastRun: FrameSample[] = [];

/**
 * Steps once per frame, after that frame's layer draw: the step's writes and
 * commit book the next frame's draw, so every frame holds one draw and one
 * step, and the frames after the last step run until no draw is left.
 */
function run(scenario: Scenario, frames: number): Promise<FrameSample[]> {
  const step = stepOf(scenario);
  const samples: FrameSample[] = [];
  let left = frames;

  pending.drawMs = 0;
  pending.draws = 0;
  cellReads = 0;

  return new Promise(resolve => {
    const tick = async (time: number) => {
      const sample: FrameSample = {
        time,
        drawMs: pending.drawMs,
        draws: pending.draws,
        scrollMs: 0,
        flushMs: 0,
        cells: cellReads,
      };
      pending.drawMs = 0;
      pending.draws = 0;
      cellReads = 0;

      if (left > 0) {
        left--;
        const start = performance.now();
        step();
        const written = performance.now();
        await whenDrawn();
        sample.scrollMs = written - start;
        sample.flushMs = performance.now() - written;
      } else if (sample.draws === 0) {
        lastRun = samples;
        resolve(samples);
        return;
      }

      samples.push(sample);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

async function settle() {
  await whenDrawn();
  await nextFrame();
  await whenDrawn();
  await nextFrame();
}

const bench: GridBench = {
  firstDraw: null,

  async remount() {
    await settle();
    unmount();
    const result = await mount();
    await settle();

    return result;
  },

  async scrollBy(domTop, left = 0) {
    const { scrollTop, scrollLeft } = scene!.state;
    scene!.setScroll(scrollTop + domTop * verticalRatio(), scrollLeft + left);
    await settle();
  },

  async jumpToRow(row, left = 0) {
    scene!.setScroll(row * scene!.state.rowHeight, left);
    await settle();
  },

  async bumpVersion() {
    generation++;
    scene!.setVersion(generation);
    await settle();
  },

  run,

  samples: () => lastRun,

  info() {
    const { state } = scene!;
    const view = scene!.visibleRange({ rows: 0, cols: 0 });
    const rows = view.rowEnd - view.rowStart + 1;
    const cols = view.frozenEnd + 1 + (view.colEnd - view.colStart + 1);

    return {
      isolated: self.crossOriginIsolated,
      devicePixelRatio: window.devicePixelRatio,
      canvasPixelRatio:
        stage?.findOne<Layer>('.grid-body')?.getCanvas().getPixelRatio() ?? 0,
      width: state.width,
      height: state.height,
      rowCount: state.rowCount,
      columnCount: state.columns.length,
      scrollRatio: verticalRatio(),
      visibleCells: rows * cols,
    };
  },
};

paintPage();
if (!BENCH) buildToolbar();
watchPixelRatio();
window.__gridBench = bench;

mount().then(result => {
  bench.firstDraw = result;
});
