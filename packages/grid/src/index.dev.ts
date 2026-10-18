import { type FC, html, nextTick, observable, render } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Layer } from 'konva/lib/Layer';
import { type Stage, stages } from 'konva/lib/Stage';

import { DEFAULT_FONT } from '@/font';
import Grid, {
  type CellContextMenuEvent,
  type CommitEvent,
  type EditorContext,
  type GridColumn,
  type GridHandle,
  type RejectEvent,
  type ViewportChange,
} from '@/Grid';
import { columnOffsets } from '@/model/columns';
import { selectCell } from '@/model/selection';
import type { CellRange, CellStyle, GridSelection } from '@/model/types';
import { DEFAULT_ROW_HEIGHT, scrollMapping } from '@/model/viewport';
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

/** The column whose cells open a select of two values in the editor slot, in place of the grid's own editor. */
const CHOICE_COLUMN = 8;

const CHOICES = ['TRUE', 'FALSE'];

/** A spreadsheet's column letters, bijective base 26: A to Z, then AA, AB and on. */
function columnLabel(index: number): string {
  let label = '';
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    label = String.fromCharCode(65 + ((rest - 1) % 26)) + label;
  }

  return label;
}

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

/** How many times the data was made new; it only grows, so a bump never brings back a string the cache still holds. */
let generation = 0;

/**
 * The generated string of a cell, decided by its indices and the generation:
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

/**
 * The values onCommit wrote, one array per column indexed by row, which win
 * over the generated ones. Clears of a million cells each add up to nearly
 * thirty million, past the 2^24 entries one Map holds; an array costs a pointer a row.
 */
const committed: Array<Array<string | undefined>> = Array.from(
  { length: COLUMN_COUNT },
  () => []
);

const cellValue = (row: number, col: number) =>
  committed[col]?.[row] ?? valueAt(row, col);

/** The page's own measures for the bench: layer draws, input events and getCell calls since the frame loop last read them. */
const totals = { drawMs: 0, draws: 0, eventMs: 0, events: 0, cells: 0 };

/** The getter the grid reads, which counts its calls; the style hook reads cellValue, so only the drawn cells count. */
function getCell(row: number, col: number): string {
  totals.cells++;

  return cellValue(row, col);
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

/** What the page hands the grid as props. */
interface DemoState {
  rowCount: number;
  columns: readonly GridColumn[];
  theme: Readonly<GridTheme>;
  frozenColumns: number;
  version: number;
}

/**
 * A column's own editor: a native select of the two values, laid over the
 * active cell's edge. Picking a value, Enter, Tab and a press outside commit
 * it, and Escape cancels; the select is removed as the edit closes.
 */
function choiceEditor(ctx: EditorContext) {
  const select = document.createElement('select');
  const typed = ctx.initialValue.trim().toUpperCase();

  for (const choice of CHOICES) {
    const option = document.createElement('option');
    option.value = choice;
    option.textContent = choice;
    select.append(option);
  }
  select.className = 'choice-editor';
  select.setAttribute('aria-label', 'Value');
  select.value = CHOICES.find(choice => choice.startsWith(typed)) ?? CHOICES[0];

  const close = (value: string | null) => {
    select.remove();
    if (value === null) ctx.cancel();
    else ctx.commit(value);
  };

  select.addEventListener('change', () => close(select.value));
  select.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== 'Tab') return;

    event.preventDefault();
    close(select.value);
  });
  ctx.onClose(reason => close(reason === 'escape' ? null : select.value));
  ctx.container.append(select);
  select.focus({ preventScroll: true });
}

const COLUMNS: GridColumn[] = Array.from(
  { length: COLUMN_COUNT },
  (_, index) => {
    const column: GridColumn = { id: `c${index}`, label: columnLabel(index) };
    if (index === 0) column.readonly = true;
    if (index === CHOICE_COLUMN) column.editor = choiceEditor;

    return column;
  }
);

/** The props as they are, which the getters read without a proxy's trap. */
const raw: DemoState = {
  rowCount: ROW_COUNT,
  columns: COLUMNS,
  theme: matchMedia('(prefers-color-scheme: dark)').matches
    ? darkTheme
    : lightTheme,
  frozenColumns: 0,
  version: 0,
};

/** The same props behind a shallow proxy, so a write re-renders the grid with them. */
const demo = observable(raw, { shallow: true });

/** Makes every generated value new and raises the version, so the grid draws them. */
function renewData() {
  generation++;
  demo.version = raw.version + 1;
}

/** The style hook: a colour on the TRUE and FALSE columns, and a read-only amount now and then. */
function getCellStyle(row: number, col: number): CellStyle | undefined {
  const kind = col % 10;

  if (kind === 8) {
    const styles = raw.theme === darkTheme ? DARK_STYLES : LIGHT_STYLES;

    return cellValue(row, col) === 'TRUE' ? styles.yes : styles.no;
  }
  if (kind === 5 && row % 17 === 0) return READONLY;

  return undefined;
}

const chevron = (colour: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M1 1l4 4 4-4' fill='none' stroke='${colour}' stroke-width='1.5'/></svg>`
  )}")`;

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
  .toolbar, .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 8px 16px;
    background: var(--grid-header);
    color: var(--grid-header-text);
  }
  .toolbar { border-bottom: 1px solid var(--grid-border); }
  .status {
    gap: 4px 16px;
    padding: 4px 16px;
    border-top: 1px solid var(--grid-border);
    font-variant-numeric: tabular-nums;
  }
  .status [data-part='notice'] { margin-left: auto; color: var(--grid-text); }
  .status [data-part='notice'][data-tone='warning'] { color: var(--grid-warning); }
  .toolbar h1 { margin: 0; font-size: 14px; font-weight: 600; color: var(--grid-text); }
  .toolbar .size, .toolbar .hint { opacity: 0.75; }
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
  .choice-editor {
    position: absolute;
    left: -1px;
    top: -1px;
    width: calc(100% + 1px);
    height: calc(100% + 1px);
    box-sizing: border-box;
    margin: 0;
    padding: 0 22px 0 7px;
    border: 2px solid var(--grid-active);
    border-radius: 0;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    font: ${DEFAULT_FONT};
    color: var(--grid-text);
    background: var(--grid-background) var(--grid-chevron) no-repeat right 8px center;
  }
`;
document.head.append(style);

const toolbar = document.createElement('header');
toolbar.className = 'toolbar';

const container = document.createElement('div');
container.className = 'grid';

const status = document.createElement('footer');
status.className = 'status';

function statusPart(name: string): HTMLSpanElement {
  const part = document.createElement('span');
  part.dataset.part = name;
  status.append(part);

  return part;
}

const selectionText = statusPart('selection');
const viewportText = statusPart('viewport');
const noticeText = statusPart('notice');
noticeText.setAttribute('role', 'status');

if (BENCH) document.body.append(container);
else document.body.append(toolbar, container, status);

function paintPage() {
  const root = document.documentElement.style;
  const { theme } = raw;
  const dark = theme === darkTheme;

  root.setProperty('--grid-background', theme.background);
  root.setProperty('--grid-header', theme.headerBackground);
  root.setProperty('--grid-header-text', theme.headerText);
  root.setProperty('--grid-text', theme.text);
  root.setProperty('--grid-border', theme.frozenBorder);
  root.setProperty('--grid-accent', theme.selectionBorder);
  root.setProperty('--grid-active', theme.activeCellBorder);
  root.setProperty('--grid-chevron', chevron(theme.headerText));
  root.setProperty('--grid-warning', dark ? '#fdd663' : '#b06000');
  root.colorScheme = dark ? 'dark' : 'light';
}

const cellName = (row: number, col: number) => `${columnLabel(col)}${row + 1}`;

const rangeName = (range: CellRange) =>
  range.startRow === range.endRow && range.startCol === range.endCol
    ? cellName(range.startRow, range.startCol)
    : `${cellName(range.startRow, range.startCol)}:${cellName(range.endRow, range.endCol)}`;

/** The ranges the status line names before it counts the rest. */
const NAMED_RANGES = 3;

let handle: GridHandle | null = null;
let selection: GridSelection = selectCell({ row: 0, col: 0 });
let viewport: ViewportChange | null = null;
let noticeTimer = 0;

function showSelection() {
  if (BENCH) return;

  const { active, ranges } = selection;
  const named = ranges.slice(0, NAMED_RANGES).map(rangeName).join(', ');
  const more =
    ranges.length > NAMED_RANGES ? ` +${ranges.length - NAMED_RANGES}` : '';
  const count = `${ranges.length} ${ranges.length === 1 ? 'range' : 'ranges'}`;

  selectionText.textContent = `Active ${cellName(active.row, active.col)} · ${count}: ${named}${more}`;
}

function showViewport() {
  if (BENCH || !viewport) return;

  const { rowStart, rowEnd, colStart, colEnd } = viewport;
  viewportText.textContent = `Rows ${grouped(rowStart + 1)}–${grouped(rowEnd + 1)} of ${grouped(raw.rowCount)} · Columns ${columnLabel(colStart)}–${columnLabel(colEnd)}`;
}

/** Shows a passing message at the end of the status line, a warning in its own colour. */
function notify(message: string, tone: 'info' | 'warning' = 'info') {
  if (BENCH) return;

  noticeText.textContent = message;
  noticeText.dataset.tone = tone;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    noticeText.textContent = '';
  }, 4000);
}

/** Writes the changes over the generated values, adds the rows a paste reached past the last, and bumps the version. */
function onCommit({ changes, source }: CommitEvent) {
  let last = raw.rowCount - 1;

  for (const { row, col, value } of changes) {
    committed[col][row] = value;
    last = Math.max(last, row);
  }
  if (last >= raw.rowCount) demo.rowCount = last + 1;
  demo.version = raw.version + 1;

  const cells = `${changes.length} ${changes.length === 1 ? 'cell' : 'cells'}`;
  notify(`${source}: ${cells} written`);
}

const REJECTIONS: Record<RejectEvent['reason'], string> = {
  'multi-range-copy':
    'Copy turned down: the ranges share neither their rows nor their columns',
  'paste-beyond-columns': 'Paste: the columns past the last were dropped',
  'too-many-cells': 'Turned down: more than a million cells at once',
};

const onReject = ({ reason }: RejectEvent) =>
  notify(REJECTIONS[reason], 'warning');

function onSelectionChange(next: GridSelection) {
  selection = next;
  showSelection();
}

function onViewportChange(next: ViewportChange) {
  viewport = next;
  showViewport();
}

/** Keeps the width a resize ended on, since the grid holds no column of its own. */
function onColumnResize(col: number, width: number) {
  demo.columns = raw.columns.map((column, index) =>
    index === col ? { ...column, width } : column
  );
  notify(`Column ${columnLabel(col)} is ${width}px wide`);
}

function onCellContextMenu(event: CellContextMenuEvent) {
  console.info('onCellContextMenu', event);
  notify(`Context menu on ${cellName(event.row, event.col)}`);
}

function onReady(next: GridHandle) {
  handle = next;
  if (!BENCH) next.focus();
}

const Demo: FC = () => () =>
  html`
    <${Grid}
      .rowCount=${demo.rowCount}
      .columns=${demo.columns}
      .getCell=${getCell}
      .getCellStyle=${getCellStyle}
      .frozenColumns=${demo.frozenColumns}
      .theme=${demo.theme}
      .version=${demo.version}
      .ariaLabel=${'Sample sheet'}
      .onCommit=${onCommit}
      .onReject=${onReject}
      .onSelectionChange=${onSelectionChange}
      .onColumnResize=${onColumnResize}
      .onViewportChange=${onViewportChange}
      .onCellContextMenu=${onCellContextMenu}
      .onReady=${onReady}
    />
  `;

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
      totals.drawMs += performance.now() - start;
      totals.draws++;
    }
  };
}

/** The input the grid's scroller handles, timed from a capture listener on the page's container to one on the scroller after the grid's own. */
const TIMED_EVENTS = ['scroll', 'pointerdown', 'pointermove', 'pointerup'];

let scroller: HTMLElement | null = null;
let eventStart = 0;

function beginEvent(event: Event) {
  if (event.target === scroller) eventStart = performance.now();
}

/**
 * Closes an event's span after the grid's listener and the microtask
 * checkpoint that follows it, so the template drain and the commit it books
 * fall inside, and the layer draws konva runs in the next frame do not.
 */
function endEvent() {
  if (!eventStart) return;

  totals.eventMs += performance.now() - eventStart;
  totals.events++;
  eventStart = 0;
}

for (const type of TIMED_EVENTS) {
  container.addEventListener(type, beginEvent, {
    capture: true,
    passive: true,
  });
}

/** Listens on a newly mounted scroller, after the grid, which bound its own listeners as it rendered. */
function timeEvents() {
  scroller = container.querySelector<HTMLElement>('.dineug-grid-scroller');
  for (const type of TIMED_EVENTS) {
    scroller?.addEventListener(type, endEvent, { passive: true });
  }
}

const gridStage = (): Stage | undefined =>
  stages.find(stage => container.contains(stage.container()));

const nextFrame = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

function resetTotals() {
  totals.drawMs = 0;
  totals.draws = 0;
  totals.eventMs = 0;
  totals.events = 0;
  totals.cells = 0;
}

/** One mount, timed from the Grid's render call to the frame after its first whenDrawn. */
export interface FirstDraw {
  /** From rendering the Grid to the frame that follows its first whenDrawn, waits included. */
  wallMs: number;
  /** The render, the commit and the layer draws: the work in that span. */
  workMs: number;
  cells: number;
}

async function mount(): Promise<FirstDraw> {
  resetTotals();
  const start = performance.now();

  render(container, html`<${Demo} />`);
  timeEvents();
  await whenDrawn();
  const committedAt = performance.now();

  // The host attaches the layers to the stage at the commit, and konva draws
  // them on the next animation frame, so this is the last point before it.
  const body = gridStage()?.findOne<Layer>('.grid-body');
  if (body) timeLayerDraws(body);
  await nextFrame();

  return {
    wallMs: performance.now() - start,
    workMs: committedAt - start + totals.drawMs,
    cells: totals.cells,
  };
}

function unmount() {
  render(container, null);
  handle = null;
  scroller = null;
}

/** A group of toolbar buttons where one choice is pressed at a time. */
function choices(
  label: string,
  options: Array<[string, string]>,
  pressed: string,
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
      buttons.forEach(other =>
        other.setAttribute('aria-pressed', String(other === button))
      );
      choose(value);
      handle?.focus();
    });

    return button;
  });

  group.append(...buttons);
  return group;
}

/** Moves the selection to a row, keeping its column, and scrolls it into view. */
function goToRow(row: number) {
  if (!handle) return;

  const col = selection.active.col;
  const next = selectCell({ row, col });
  handle.scrollTo(row, col);
  handle.select(next);
  handle.focus();
  // The grid echoes no selection its host made, so the line shows it here.
  selection = next;
  showSelection();
}

function buildToolbar() {
  const title = document.createElement('h1');
  const size = document.createElement('span');
  const hint = document.createElement('span');
  title.textContent = '@dineug/grid';
  size.className = 'size';
  size.textContent = `${grouped(ROW_COUNT)} rows × ${COLUMN_COUNT} columns`;
  hint.className = 'hint';
  hint.textContent = `Column ${columnLabel(CHOICE_COLUMN)} edits in a select; column A and every 17th amount are read-only`;

  const goTo = document.createElement('input');
  goTo.type = 'number';
  goTo.min = '1';
  goTo.max = String(ROW_COUNT);
  goTo.placeholder = 'Go to row';
  goTo.setAttribute('aria-label', 'Go to row');
  goTo.addEventListener('change', () => {
    const row = Math.min(raw.rowCount, Math.max(1, Number(goTo.value) || 1));
    goToRow(row - 1);
  });

  const bump = document.createElement('button');
  bump.type = 'button';
  bump.textContent = 'New data';
  bump.addEventListener('click', () => {
    renewData();
    handle?.focus();
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
      raw.theme === darkTheme ? 'dark' : 'light',
      value => {
        demo.theme = value === 'dark' ? darkTheme : lightTheme;
        paintPage();
      }
    ),
    choices(
      'Frozen',
      [
        ['0', 'None'],
        ['2', '2 columns'],
      ],
      String(raw.frozenColumns),
      value => {
        demo.frozenColumns = Number(value);
      }
    ),
    bump,
    goTo,
    hint
  );
}

/** One animation frame's main-thread work, as the bench reads it back. */
export interface FrameSample {
  /** The frame's requestAnimationFrame timestamp. */
  time: number;
  /** Konva layer draws in the frame. */
  drawMs: number;
  draws: number;
  /** The scroller's scroll and pointer events, each with the drain and commit after its listener. */
  eventMs: number;
  events: number;
  /** The writes of a step the page ran in the frame: a jump or a version bump. */
  stepMs: number;
  /** From those writes to whenDrawn: the template drain and the commit that marks the layers. */
  flushMs: number;
  /** getCell calls in the frame, one per cell the body drew. */
  cells: number;
}

/** What the page steps once per frame itself; the wheel and the thumb drag come from the bench's real input. */
export type Scenario =
  | { kind: 'idle' }
  | { kind: 'jump'; seed: number }
  | { kind: 'version' };

/** A point in the page's client coordinates. */
export interface ClientPoint {
  x: number;
  y: number;
}

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
  /** The cells in view with no overscan, as onViewportChange last reported them. */
  visibleCells: number;
  /** The scroller's DOM offset, which tells how far a wheel moved it. */
  scrollTop: number;
}

/** The page's bench hooks, which only this demo installs. */
export interface GridBench {
  firstDraw: FirstDraw | null;
  /** Unmounts the grid and renders a new one, timed as firstDraw is. */
  remount(): Promise<FirstDraw>;
  /** Runs one step of a scenario per frame, frames times, and returns each frame's sample. */
  run(scenario: Scenario, frames: number): Promise<FrameSample[]>;
  /** Samples every frame from now, while the bench drives the page's real input. */
  record(): void;
  /** Ends the recording once the frames after the last input have drawn, and returns its samples. */
  stop(): Promise<FrameSample[]>;
  nextFrame(): Promise<void>;
  /** Scrolls back to the first cell through the handle and waits for the draw. */
  toTop(): Promise<void>;
  /** The middle of the cells in view, where a wheel lands on the scroller. */
  bodyPoint(): ClientPoint;
  /** The middle of a cell at the scroll offsets now, for input aimed at one. */
  cellPoint(row: number, col: number): ClientPoint;
  /** The vertical thumb's middle, and the pointer height past which it reaches the end of its track. */
  thumb(): ClientPoint & { end: number };
  viewport(): ViewportChange | null;
  info(): BenchInfo;
}

declare global {
  interface Window {
    __gridBench?: GridBench;
  }
}

/** A seeded generator, so two runs jump through the same cells. */
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

function stepOf(scenario: Scenario): (() => void) | null {
  switch (scenario.kind) {
    case 'jump': {
      const next = random(scenario.seed);

      return () =>
        handle?.scrollTo(
          Math.floor(next() * raw.rowCount),
          Math.floor(next() * COLUMN_COUNT)
        );
    }
    case 'version':
      return renewData;
    default:
      return null;
  }
}

const drained = () => nextTick(() => {});

/** The frame loop of a run or a recording, which ends once no frames are left to step and nothing drew. */
interface FrameLoop {
  left: number;
  done: Promise<FrameSample[]>;
}

let loop: FrameLoop | null = null;

/**
 * Samples every frame: the animation frame callback opens a sample, steps the
 * scenario if one is left, and posts a message, which runs once the frame's
 * draws and paint are done and closes the sample with what they took.
 */
function frameLoop(step: (() => void) | null, frames: number): FrameLoop {
  const samples: FrameSample[] = [];
  const channel = new MessageChannel();
  let open: FrameSample | null = null;
  /** Whether the open sample, and the last one closed, began after the last step or the end of a recording. */
  let openTrailing = false;
  let lastTrailing = false;
  let finish!: (samples: FrameSample[]) => void;
  const state: FrameLoop = {
    left: frames,
    done: new Promise(resolve => {
      finish = resolve;
    }),
  };

  const close = () => {
    const sample = open;
    if (!sample) return;

    open = null;
    lastTrailing = openTrailing;
    sample.drawMs = totals.drawMs;
    sample.draws = totals.draws;
    sample.eventMs = totals.eventMs;
    sample.events = totals.events;
    sample.cells = totals.cells;
    resetTotals();
    samples.push(sample);
  };

  const tick = async (time: number) => {
    // A message the frame before posted that has not run yet closes first.
    close();

    // A frame after the last step that drew nothing and handled no input
    // ends the loop, and is not a sample of it.
    const last = samples[samples.length - 1];
    if (lastTrailing && last && last.draws === 0 && last.events === 0) {
      channel.port1.close();
      samples.pop();
      finish(samples);
      return;
    }

    requestAnimationFrame(tick);
    const sample: FrameSample = {
      time,
      drawMs: 0,
      draws: 0,
      eventMs: 0,
      events: 0,
      stepMs: 0,
      flushMs: 0,
      cells: 0,
    };
    open = sample;
    openTrailing = state.left <= 0;
    channel.port2.postMessage(null);

    if (openTrailing) return;
    state.left--;
    if (!step) return;

    const start = performance.now();
    step();
    const written = performance.now();
    await drained();
    await whenDrawn();
    sample.stepMs = written - start;
    sample.flushMs = performance.now() - written;
  };

  channel.port1.onmessage = close;
  resetTotals();
  requestAnimationFrame(tick);

  return state;
}

async function settle() {
  await whenDrawn();
  await nextFrame();
  await whenDrawn();
  await nextFrame();
}

/** A stage node's rectangle in the page's client coordinates. */
function clientRect(name: string) {
  const node = gridStage()?.findOne(`.${name}`);
  const origin = container.getBoundingClientRect();

  return {
    x: origin.left + (node?.x() ?? 0),
    y: origin.top + (node?.y() ?? 0),
    width: node?.width() ?? 0,
    height: node?.height() ?? 0,
  };
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

  run(scenario, frames) {
    loop = frameLoop(stepOf(scenario), frames);
    return loop.done;
  },

  record() {
    loop = frameLoop(null, Infinity);
  },

  stop() {
    if (!loop) return Promise.resolve([]);

    loop.left = 0;
    return loop.done;
  },

  nextFrame,

  async toTop() {
    handle?.scrollTo(0, 0);
    await settle();
  },

  bodyPoint() {
    const body = clientRect('grid-body-cells');

    return { x: body.x + body.width / 2, y: body.y + body.height / 2 };
  },

  cellPoint(row, col) {
    const body = clientRect('grid-body-cells');
    const frozen = clientRect('grid-frozen-cells');
    const scroll = gridStage()?.findOne('.grid-body-scroll');
    const offsets = columnOffsets(raw.columns);
    const left =
      col < raw.frozenColumns ? frozen.x : body.x + (scroll?.x() ?? 0);
    const top = body.y + (scroll?.y() ?? 0);

    return {
      x: left + (offsets[col] + offsets[col + 1]) / 2,
      y: top + (row + 0.5) * DEFAULT_ROW_HEIGHT,
    };
  },

  thumb() {
    const thumb = clientRect('grid-vertical-thumb');
    const body = clientRect('grid-body-cells');
    const y = thumb.y + thumb.height / 2;
    const travel = body.height - thumb.height;

    return {
      x: thumb.x + thumb.width / 2,
      y,
      end: Math.min(window.innerHeight - 1, y + travel + 4),
    };
  },

  viewport: () => viewport,

  info() {
    const rows = viewport ? viewport.rowEnd - viewport.rowStart + 1 : 0;
    const cols = viewport ? viewport.colEnd - viewport.colStart + 1 : 0;
    const body = gridStage()?.findOne<Layer>('.grid-body');

    return {
      isolated: self.crossOriginIsolated,
      devicePixelRatio: window.devicePixelRatio,
      canvasPixelRatio: body?.getCanvas().getPixelRatio() ?? 0,
      width: container.clientWidth,
      height: container.clientHeight,
      rowCount: raw.rowCount,
      columnCount: raw.columns.length,
      scrollRatio: scrollMapping(raw.rowCount * DEFAULT_ROW_HEIGHT).ratio,
      visibleCells: rows * cols,
      scrollTop: scroller?.scrollTop ?? 0,
    };
  },
};

paintPage();
if (!BENCH) buildToolbar();
showSelection();
window.__gridBench = bench;

mount().then(result => {
  bench.firstDraw = result;
});
