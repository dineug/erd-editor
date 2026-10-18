// What the component's browser specs share: a mount through a host whose
// props are observable, the layout read off the scene's nodes, the points of
// cells and headers, and synthetic pointer, mouse and key events.

import { type FC, observable, render } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import { type Stage, stages } from 'konva/lib/Stage';
import { type Mock, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';

import { drawn, nextFrame } from '@/__test-utils__/scene';
import Grid, {
  type CommitEvent,
  type GridColumn,
  type GridHandle,
  type GridProps,
  type RejectEvent,
  type ViewportChange,
} from '@/Grid';
import { columnOffsets } from '@/model/columns';
import { isApplePlatform } from '@/model/keys';
import type { CellRange, GridSelection } from '@/model/types';

export const WIDTH = 900;

export const HEIGHT = 560;

export const ROW_COUNT = 1000;

export const MILLION = 1_000_000;

export const ROW_HEIGHT = 28;

/** A spreadsheet's column letters, bijective base 26: A to Z, then AA, AB and on. */
const columnLabel = (index: number) => {
  let label = '';
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    label = String.fromCharCode(65 + ((rest - 1) % 26)) + label;
  }

  return label;
};

export const COLUMNS: GridColumn[] = Array.from({ length: 30 }, (_, index) => ({
  id: `c${index}`,
  label: columnLabel(index),
}));

export const valueOf = (row: number, col: number) => `${row}:${col}`;

/** The modifier that adds a range here: Cmd on an Apple platform, Ctrl elsewhere. */
export const MOD = isApplePlatform(navigator.platform)
  ? { metaKey: true }
  : { ctrlKey: true };

export interface Point {
  x: number;
  y: number;
}

export interface View {
  props: GridProps;
  host: HTMLDivElement;
  container: HTMLDivElement;
  sheet: HTMLStyleElement;
  stageHost: HTMLDivElement;
  scroller: HTMLDivElement;
  spacer: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  slot: HTMLDivElement;
  stage: Stage;
  handle: GridHandle;
  onSelectionChange: Mock<(selection: GridSelection) => void>;
  onViewportChange: Mock<(viewport: ViewportChange) => void>;
  onColumnResize: Mock<(col: number, width: number) => void>;
  onCommit: Mock<(event: CommitEvent) => void>;
  onReject: Mock<(event: RejectEvent) => void>;
  unmount(): void;
}

/** The grids mounted in a spec, which cleanup unmounts; a spec that unmounts one itself takes it out. */
export const views: View[] = [];

/** What a spec restores after it, run by cleanup. */
export const teardowns: Array<() => void> = [];

/** Sizes the page past the grid, since a real press or wheel lands only on what the viewport shows. */
export const sizePage = () => page.viewport(WIDTH + 200, HEIGHT + 200);

/** Unmounts every grid a spec mounted and restores what it changed, after each spec. */
export async function cleanup(): Promise<void> {
  for (const view of views.splice(0)) view.unmount();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
  vi.restoreAllMocks();
}

/**
 * Mounts a grid through a host template whose props are observable, so a
 * spec changes a prop by writing it, as a host's own state would, and waits
 * for the first draw and the first viewport report, in a shadow root if asked.
 */
export async function mount(
  init: Partial<GridProps> = {},
  size = { width: WIDTH, height: HEIGHT },
  before?: HTMLElement,
  shadow?: ShadowRootMode
): Promise<View> {
  const host = document.createElement('div');
  host.style.width = `${size.width}px`;
  host.style.height = `${size.height}px`;
  if (before) document.body.append(before);
  const outer = shadow ? document.createElement('div') : host;
  if (shadow) outer.attachShadow({ mode: shadow }).append(host);
  document.body.append(outer);

  const onSelectionChange = vi.fn<(selection: GridSelection) => void>();
  const onViewportChange = vi.fn<(viewport: ViewportChange) => void>();
  const onColumnResize = vi.fn<(col: number, width: number) => void>();
  const onCommit = vi.fn<(event: CommitEvent) => void>();
  const onReject = vi.fn<(event: RejectEvent) => void>();
  let handle: GridHandle | null = null;
  const props = observable<GridProps>(
    {
      rowCount: ROW_COUNT,
      columns: COLUMNS,
      getCell: valueOf,
      onSelectionChange,
      onViewportChange,
      onColumnResize,
      onCommit,
      onReject,
      onReady: next => {
        handle = next;
      },
      ...init,
    },
    { shallow: true }
  );

  const Host: FC = () => () => (
    <Grid
      rowCount={props.rowCount}
      columns={props.columns}
      getCell={props.getCell}
      getCellStyle={props.getCellStyle}
      rowHeight={props.rowHeight}
      frozenColumns={props.frozenColumns}
      theme={props.theme}
      font={props.font}
      version={props.version}
      ariaLabel={props.ariaLabel}
      onCommit={props.onCommit}
      onReject={props.onReject}
      onSelectionChange={props.onSelectionChange}
      onColumnResize={props.onColumnResize}
      onViewportChange={props.onViewportChange}
      onCellContextMenu={props.onCellContextMenu}
      onReady={props.onReady}
    />
  );

  render(host, <Host />);
  await drawn();
  await nextFrame();

  const container = host.querySelector('.dineug-grid') as HTMLDivElement;
  const [sheet, stageHost, scroller, textarea, slot] = Array.from(
    container.children
  ) as [
    HTMLStyleElement,
    HTMLDivElement,
    HTMLDivElement,
    HTMLTextAreaElement,
    HTMLDivElement,
  ];
  const stage = stages.find(each => each.container() === stageHost) as Stage;

  const view: View = {
    props,
    host,
    container,
    sheet,
    stageHost,
    scroller,
    spacer: scroller.firstElementChild as HTMLDivElement,
    textarea,
    slot,
    stage,
    handle: handle as unknown as GridHandle,
    onSelectionChange,
    onViewportChange,
    onColumnResize,
    onCommit,
    onReject,
    unmount: () => {
      render(host, null);
      host.remove();
      outer.remove();
      before?.remove();
    },
  };
  views.push(view);

  return view;
}

/** A k-* node of the scene by its name, which carries the place the template wrote. */
export const node = (view: View, name: string) =>
  view.stage.findOne(`.${name}`) as NonNullable<ReturnType<Stage['findOne']>>;

/** The layout as the scene's nodes hold it, and the content its scrolling cells show. */
export function geometry(view: View) {
  const corner = node(view, 'grid-corner');
  const body = node(view, 'grid-body-cells');
  const frozen = node(view, 'grid-frozen-cells');
  const scroll = node(view, 'grid-body-scroll');

  return {
    headerHeight: corner.height(),
    rowHeaderWidth: corner.width(),
    body: {
      x: body.x(),
      y: body.y(),
      width: body.width(),
      height: body.height(),
    },
    frozen: { x: frozen.x(), width: frozen.width() },
    /** The content offsets the scrolling cells show at their top-left corner. */
    top: -scroll.y(),
    left: -scroll.x(),
  };
}

export const offsetsOf = (view: View) => columnOffsets(view.props.columns);

/** A cell's rectangle, in the container's coordinates, at the scroll offsets now. */
export function cellBox(view: View, row: number, col: number) {
  const g = geometry(view);
  const offsets = offsetsOf(view);
  const rowHeight = view.props.rowHeight ?? ROW_HEIGHT;
  const x =
    col < (view.props.frozenColumns ?? 0)
      ? g.frozen.x + offsets[col]
      : g.body.x + offsets[col] - g.left;

  return {
    x,
    y: g.body.y + row * rowHeight - g.top,
    width: offsets[col + 1] - offsets[col],
    height: rowHeight,
  };
}

/** The middle of a cell, in the container's coordinates, at the scroll offsets now. */
export function cellPoint(view: View, row: number, col: number): Point {
  const box = cellBox(view, row, col);

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The middle of a column's header cell. */
export function headerPoint(view: View, col: number): Point {
  return { x: cellPoint(view, 0, col).x, y: geometry(view).headerHeight / 2 };
}

/** The middle of a row's number. */
export function rowNumberPoint(view: View, row: number): Point {
  return { x: geometry(view).rowHeaderWidth / 2, y: cellPoint(view, row, 0).y };
}

/** A point on the right edge of a column's header cell. */
export function edgePoint(view: View, col: number): Point {
  const offsets = offsetsOf(view);
  const g = geometry(view);

  return {
    x: g.body.x + offsets[col + 1] - g.left,
    y: g.headerHeight / 2,
  };
}

export const centreOf = (view: View, name: string): Point => {
  const rect = node(view, name);

  return { x: rect.x() + rect.width() / 2, y: rect.y() + rect.height() / 2 };
};

type PointerType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel';

/** A synthetic pointer event on the scroller at a container point, as the main mouse button makes it. */
export function pointer(
  view: View,
  type: PointerType,
  point: Point,
  init: PointerEventInit = {}
): PointerEvent {
  const rect = view.scroller.getBoundingClientRect();
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
    clientX: rect.left + point.x,
    clientY: rect.top + point.y,
    ...init,
  });

  view.scroller.dispatchEvent(event);
  return event;
}

export function press(view: View, point: Point, init: PointerEventInit = {}) {
  pointer(view, 'pointerdown', point, init);
  pointer(view, 'pointerup', point, init);
}

export function mouse(
  view: View,
  type: string,
  point: Point,
  init: MouseEventInit = {}
) {
  const rect = view.scroller.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: rect.left + point.x,
    clientY: rect.top + point.y,
    ...init,
  });

  view.scroller.dispatchEvent(event);
  return event;
}

/** A synthetic keydown on the focus textarea, or on the target given. */
export function key(
  view: View,
  value: string,
  init: KeyboardEventInit = {},
  target: EventTarget = view.textarea
) {
  const event = new KeyboardEvent('keydown', {
    key: value,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });

  target.dispatchEvent(event);
  return event;
}

export const lastSelection = (view: View) =>
  view.onSelectionChange.mock.lastCall?.[0];

export const lastViewport = (view: View) =>
  view.onViewportChange.mock.lastCall?.[0];

export const range = (
  startRow: number,
  startCol: number,
  endRow = startRow,
  endCol = startCol
): CellRange => ({
  startRow,
  startCol,
  endRow,
  endCol,
});

export const spacerSize = (view: View) => ({
  width: parseFloat(view.spacer.style.width),
  height: parseFloat(view.spacer.style.height),
});
