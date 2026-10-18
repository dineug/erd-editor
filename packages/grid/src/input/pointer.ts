import { measureNaturalWidth } from '@chenglou/pretext';

import {
  clampColumnWidth,
  columnAt,
  RESIZE_TOLERANCE,
  resizeEdgeAt,
} from '@/model/columns';
import { selectionModifiers } from '@/model/keys';
import {
  clickCell,
  clickColumnHeader,
  clickCorner,
  clickRowHeader,
  dragTo,
} from '@/model/selection';
import { normalizeCellText, prepareCellText } from '@/model/text';
import type { CellRef, GridBounds, GridSelection } from '@/model/types';
import { rowAt } from '@/model/viewport';
import { CELL_PADDING } from '@/scene/draw/context';
import { type ScrollbarAxis, scrollbars } from '@/scene/draw/scrollbar';
import type { SceneRect } from '@/scene/layout';
import type { SceneData, SceneState } from '@/scene/state';

/** One of the two scrollbars. */
export type ScrollAxis = 'vertical' | 'horizontal';

/** What lies under a point of the grid, in the stage coordinates the layout uses. */
export type GridHit =
  | { kind: 'corner' }
  | { kind: 'column'; col: number }
  | { kind: 'edge'; col: number }
  | { kind: 'row'; row: number }
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'thumb'; axis: ScrollAxis }
  | { kind: 'track'; axis: ScrollAxis; direction: -1 | 1 }
  | { kind: 'none' };

/** A point in the grid container, in CSS pixels from its top-left corner. */
export interface GridPoint {
  x: number;
  y: number;
}

/** The fewest DOM pixels an edge drag scrolls a frame. */
export const AUTO_SCROLL_MIN = 2;

/** The most DOM pixels an edge drag scrolls a frame, however far past the edge the pointer is. */
export const AUTO_SCROLL_MAX = 48;

const NONE: GridHit = Object.freeze({ kind: 'none' });

const CORNER: GridHit = Object.freeze({ kind: 'corner' });

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The row under a stage y in the cell area, or -1 above it, below it or past the last row. */
export function rowAtY(state: Readonly<SceneData>, y: number): number {
  const { layout } = state;
  const local = y - layout.headerHeight;

  if (!(local >= 0 && local < layout.cellHeight)) return -1;

  return rowAt(local + state.scrollTop, state.rowHeight, state.rowCount);
}

/**
 * The column under a stage x in the cell area, or -1 outside it or past the
 * last column. Left of the frozen boundary the frozen columns show, which
 * never scroll; right of it the scrolling ones, from the scroll offset.
 */
export function columnAtX(state: Readonly<SceneData>, x: number): number {
  const { layout, offsets } = state;
  const local = x - layout.rowHeaderWidth;

  if (!(local >= 0 && local < layout.cellWidth)) return -1;

  const content =
    local < layout.frozenWidth
      ? local
      : local - layout.frozenWidth + layout.scrollOrigin + state.scrollLeft;

  return columnAt(offsets, content);
}

/**
 * The column whose right edge a stage x grabs, the nearest within the
 * tolerance, or -1. Only an edge that shows counts: a frozen one inside the
 * frozen region, a scrolling one right of the frozen boundary.
 */
export function edgeAtX(state: Readonly<SceneData>, x: number): number {
  const { layout, offsets } = state;
  const local = x - layout.rowHeaderWidth;
  const frozen = layout.frozenCount;
  let found = -1;
  let distance = Infinity;

  const consider = (col: number, edge: number) => {
    const away = Math.abs(local - edge);

    if (away <= RESIZE_TOLERANCE && away < distance) {
      found = col;
      distance = away;
    }
  };

  if (frozen > 0) {
    const col = resizeEdgeAt(offsets, local);
    const edge = offsets[col + 1];

    if (col >= 0 && col < frozen && edge <= layout.frozenWidth) {
      consider(col, edge);
    }
  }

  if (local >= layout.frozenWidth - RESIZE_TOLERANCE) {
    const shift = layout.scrollOrigin + state.scrollLeft - layout.frozenWidth;
    const col = resizeEdgeAt(offsets, local + shift);
    const edge = offsets[col + 1] - shift;

    if (
      col >= frozen &&
      edge > layout.frozenWidth &&
      edge <= layout.cellWidth
    ) {
      consider(col, edge);
    }
  }

  return found;
}

const inSpan = (value: number, start: number, length: number) =>
  value >= start && value < start + length;

/** A press on a scrollbar: on its thumb, or on its track before or after it. */
function barHit(
  bar: ScrollbarAxis,
  axis: ScrollAxis,
  { x, y }: GridPoint
): GridHit | null {
  const { track, thumb } = bar;

  if (
    !bar.visible ||
    !inSpan(x, track.x, track.width) ||
    !inSpan(y, track.y, track.height)
  ) {
    return null;
  }

  const along = axis === 'vertical' ? y : x;
  const start = axis === 'vertical' ? thumb.y : thumb.x;
  const length = axis === 'vertical' ? thumb.height : thumb.width;

  if (inSpan(along, start, length)) return { kind: 'thumb', axis };

  return { kind: 'track', axis, direction: along < start ? -1 : 1 };
}

/**
 * What lies under a stage point: a scrollbar first, since it draws over the
 * cells, then the corner, a header, a column edge in the column header, or a
 * cell. Space past the last row or column hits nothing.
 */
export function hitTest(state: Readonly<SceneData>, point: GridPoint): GridHit {
  const { layout } = state;
  const { x, y } = point;

  if (!(inSpan(x, 0, layout.width) && inSpan(y, 0, layout.height))) {
    return NONE;
  }

  const bars = scrollbars(layout, state.scrollTop, state.scrollLeft);
  const bar =
    barHit(bars.vertical, 'vertical', point) ??
    barHit(bars.horizontal, 'horizontal', point);
  if (bar) return bar;

  const header = y < layout.headerHeight;

  if (x < layout.rowHeaderWidth) {
    if (header) return CORNER;

    const row = rowAtY(state, y);
    return row >= 0 ? { kind: 'row', row } : NONE;
  }

  if (header) {
    const edge = edgeAtX(state, x);
    if (edge >= 0) return { kind: 'edge', col: edge };

    const col = columnAtX(state, x);
    return col >= 0 ? { kind: 'column', col } : NONE;
  }

  const row = rowAtY(state, y);
  const col = columnAtX(state, x);

  return row >= 0 && col >= 0 ? { kind: 'cell', row, col } : NONE;
}

/**
 * Where a cell sits on the stage at the scroll offsets, unclipped: a frozen
 * column from the frozen region's left, a scrolling one moved by the scroll.
 * The rectangle may lie far outside the view, by millions of pixels.
 */
export function cellRect(state: Readonly<SceneData>, cell: CellRef): SceneRect {
  const { layout, offsets } = state;
  const col = clamp(cell.col, 0, Math.max(0, offsets.length - 2));
  const left = offsets[col] ?? 0;
  const right = offsets[col + 1] ?? left;
  const x =
    col < layout.frozenCount
      ? layout.frozenBody.x + left
      : layout.body.x + left - layout.scrollOrigin - state.scrollLeft;

  return {
    x,
    y: layout.body.y + cell.row * state.rowHeight - state.scrollTop,
    width: right - left,
    height: state.rowHeight,
  };
}

/** The region a column's cells show in: the frozen cells or the scrolling ones. */
export const regionOf = (state: Readonly<SceneData>, col: number): SceneRect =>
  col < state.layout.frozenCount ? state.layout.frozenBody : state.layout.body;

/** The cell area, every cell region together, between the headers and the scrollbars. */
export const cellArea = ({ layout }: Readonly<SceneData>): SceneRect => ({
  x: layout.rowHeaderWidth,
  y: layout.headerHeight,
  width: layout.cellWidth,
  height: layout.cellHeight,
});

/**
 * The cell nearest a stage point, held to the cell area and to the last row
 * and column, which a drag past an edge extends to; null for a grid with no
 * cell or no area to show one in.
 */
export function cellNear(
  state: Readonly<SceneData>,
  { x, y }: GridPoint
): CellRef | null {
  const area = cellArea(state);
  const colCount = state.columns.length;

  if (state.rowCount < 1 || colCount < 1) return null;
  if (area.width < 1 || area.height < 1) return null;

  const held = {
    x: clamp(x, area.x, area.x + area.width - 1),
    y: clamp(y, area.y, area.y + area.height - 1),
  };
  const row = Math.floor((held.y - area.y + state.scrollTop) / state.rowHeight);
  const col = columnAtX(state, held.x);

  return {
    row: clamp(row, 0, state.rowCount - 1),
    col: col >= 0 ? col : colCount - 1,
  };
}

/** How far a point lies past a span, negative before it and positive after it. */
const past = (value: number, start: number, end: number) =>
  value < start ? value - start : value > end ? value - end : 0;

/** The DOM pixels an edge drag scrolls this frame, faster the farther past the edge. */
export function autoScrollStep(distance: number): number {
  if (distance === 0) return 0;

  const step = Math.min(
    AUTO_SCROLL_MAX,
    AUTO_SCROLL_MIN + Math.round(Math.abs(distance) / 2)
  );

  return distance < 0 ? -step : step;
}

/**
 * How wide a column must be to show every visible row's text whole: the
 * widest text pretext measures, the cell padding both sides, never under
 * the minimum width.
 */
export function fitWidth(scene: SceneState, col: number): number {
  const { state } = scene;
  const range = scene.visibleRange({ rows: 0, cols: 0 });
  let widest = 0;

  for (let row = range.rowStart; row <= range.rowEnd; row++) {
    const text = normalizeCellText(state.getCell(row, col));
    if (!text) continue;

    widest = Math.max(
      widest,
      measureNaturalWidth(prepareCellText(text, state.font))
    );
  }

  return clampColumnWidth(Math.ceil(widest) + CELL_PADDING * 2);
}

/** A scroll by DOM pixels on each axis, as scrollBy takes it. */
export interface ScrollDelta {
  left: number;
  top: number;
}

/** The scroll a wheel event asks for, in DOM pixels, a line counted as a row and a page as the view. */
export function wheelScroll(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>,
  lineHeight: number,
  pageHeight: number
): ScrollDelta {
  const unit =
    event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? pageHeight : 1;
  // A plain mouse wheel under Shift scrolls across, as a native scroller does.
  const sideways = event.shiftKey && event.deltaX === 0;

  return {
    left: (sideways ? event.deltaY : event.deltaX) * unit,
    top: (sideways ? 0 : event.deltaY) * unit,
  };
}

const scrollable = (overflow: string) =>
  overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';

/** Whether an element scrolls and can still move the way a scroll asks, by a whole pixel at least. */
function canScroll(element: Element, { left, top }: ScrollDelta): boolean {
  const style = getComputedStyle(element);
  const room = (offset: number, max: number, delta: number) =>
    delta < 0 ? offset > 0 : delta > 0 && Math.ceil(offset) < max;

  return (
    (scrollable(style.overflowY) &&
      room(
        element.scrollTop,
        element.scrollHeight - element.clientHeight,
        top
      )) ||
    (scrollable(style.overflowX) &&
      room(element.scrollLeft, element.scrollWidth - element.clientWidth, left))
  );
}

/**
 * Whether an element on a wheel's path, from its target up to the boundary,
 * can still scroll the way the wheel turns, so it keeps the wheel: a list a
 * host draws in the editor slot scrolls before the grid does.
 */
export function scrollsWithin(
  path: readonly EventTarget[],
  boundary: Element,
  delta: ScrollDelta
): boolean {
  for (const target of path) {
    if (target === boundary) return false;

    const element = target as Element;
    if (element.nodeType === 1 && canScroll(element, delta)) return true;
  }

  return false;
}

/** What the pointer input reads from the grid and asks of it. */
export interface PointerHost {
  readonly scene: SceneState;
  /** The DOM scroller every pointer event arrives on, over the stage. */
  readonly scroller: HTMLElement;
  /** Whether Cmd selects, as on an Apple platform, instead of Ctrl. */
  readonly apple: boolean;
  selection(): GridSelection;
  /** Hands over a selection gesture's result; the same object back means nothing changed. */
  select(next: GridSelection): void;
  /** Scrolls the content to offsets in content pixels, the DOM scroller with it. */
  scrollContentTo(top: number, left: number): void;
  /** Brings the scene to the scroller's DOM offsets now, as its next scroll event would. */
  syncScroll(): void;
  /** A resize ended on a new width: a drag let go, or a double click fit the column. */
  columnResized(col: number, width: number): void;
  /** A double click landed on a cell, which opens its editor. */
  cellDoubleClicked(cell: CellRef): void;
}

/** The handlers the grid binds on its scroller. */
export interface PointerInput {
  /** A point of the container, from a pointer or mouse event's client coordinates. */
  pointOf(event: { clientX: number; clientY: number }): GridPoint;
  pointerdown(event: PointerEvent): void;
  pointermove(event: PointerEvent): void;
  pointerup(event: PointerEvent): void;
  /** Ends a drag without its result: a resize goes back to the column's width. */
  pointercancel(event: PointerEvent): void;
  dblclick(event: MouseEvent): void;
  /** Ends any drag and its edge scroll loop, as an unmount does. */
  dispose(): void;
}

type SelectDrag = {
  kind: 'cells' | 'columns' | 'rows';
  pointerId: number;
  point: GridPoint;
};

type ResizeDrag = {
  kind: 'resize';
  pointerId: number;
  col: number;
  startX: number;
  startWidth: number;
  width: number;
};

type ThumbDrag = {
  kind: 'thumb';
  pointerId: number;
  axis: ScrollAxis;
  /** The pointer's position along the axis, and the scroll offset, when the press began. */
  start: number;
  offset: number;
};

type Drag = SelectDrag | ResizeDrag | ThumbDrag;

const RESIZE_CURSOR = 'col-resize';

/**
 * The grid's pointer input: a press selects, a drag extends and scrolls past
 * an edge, a header edge resizes, a thumb or track scrolls. A touch or a
 * button but the main one does nothing, and every hit is the layout's.
 */
export function createPointerInput(host: PointerHost): PointerInput {
  const { scene, scroller, apple } = host;
  let drag: Drag | null = null;
  let frame = 0;

  const pointOf = (event: { clientX: number; clientY: number }) => {
    const rect = scroller.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const bounds = (): GridBounds => ({
    rowCount: scene.state.rowCount,
    colCount: scene.state.columns.length,
  });

  const capture = (pointerId: number) => {
    try {
      scroller.setPointerCapture(pointerId);
    } catch {
      // A pointer the browser no longer counts as active cannot be captured;
      // the drag still follows the moves that reach the scroller.
    }
  };

  const setCursor = (cursor: string) => {
    if (scroller.style.cursor !== cursor) scroller.style.cursor = cursor;
  };

  /** Extends the selection to the point a select drag holds, the scroll offsets as they are now. */
  const extend = (held: SelectDrag) => {
    const { state } = scene;
    const selection = host.selection();

    if (held.kind === 'cells') {
      const cell = cellNear(state, held.point);
      if (cell) host.select(dragTo(selection, cell));
      return;
    }

    const cell = cellNear(state, held.point);
    if (!cell) return;

    host.select(
      held.kind === 'columns'
        ? clickColumnHeader(selection, cell.col, { shift: true }, bounds())
        : clickRowHeader(selection, cell.row, { shift: true }, bounds())
    );
  };

  /** How far past the cell area a select drag's point is, on the axes its kind scrolls. */
  const overflow = (held: SelectDrag) => {
    const area = cellArea(scene.state);
    const { x, y } = held.point;

    return {
      dx: held.kind === 'rows' ? 0 : past(x, area.x, area.x + area.width),
      dy: held.kind === 'columns' ? 0 : past(y, area.y, area.y + area.height),
    };
  };

  /** One frame of the edge scroll: scroll, bring the scene along, extend to the cell now under the point. */
  const tick = () => {
    frame = 0;
    if (!drag || drag.kind === 'resize' || drag.kind === 'thumb') return;

    const { dx, dy } = overflow(drag);
    if (dx === 0 && dy === 0) return;

    scroller.scrollTop += autoScrollStep(dy);
    scroller.scrollLeft += autoScrollStep(dx);
    host.syncScroll();
    extend(drag);
    frame = requestAnimationFrame(tick);
  };

  const autoScroll = (held: SelectDrag) => {
    if (frame) return;

    const { dx, dy } = overflow(held);
    if (dx !== 0 || dy !== 0) frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    drag = null;
  };

  /** Ends a drag without its result, so a resize goes back to the column's width. */
  const cancel = () => {
    const ended = drag;
    stop();
    if (ended?.kind === 'resize') scene.setResize(null);
  };

  /** A press on a track pages the content one view toward the press. */
  const pageTrack = (axis: ScrollAxis, direction: -1 | 1) => {
    const { layout, scrollTop, scrollLeft } = scene.state;

    if (axis === 'vertical') {
      host.scrollContentTo(
        scrollTop + direction * layout.cellHeight,
        scrollLeft
      );
    } else {
      host.scrollContentTo(
        scrollTop,
        scrollLeft + direction * layout.body.width
      );
    }
  };

  /**
   * A thumb follows the pointer along its track: the distance moved is the
   * same share of the scroll range as of the track the thumb can travel.
   */
  const moveThumb = (held: ThumbDrag, point: GridPoint) => {
    const { layout, scrollTop, scrollLeft } = scene.state;
    const bars = scrollbars(layout, scrollTop, scrollLeft);

    if (held.axis === 'vertical') {
      const travel = layout.body.height - bars.vertical.thumb.height;
      const moved = point.y - held.start;
      const top =
        travel > 0 ? held.offset + (moved * layout.maxScrollTop) / travel : 0;
      host.scrollContentTo(top, scrollLeft);
      return;
    }

    const travel = layout.body.width - bars.horizontal.thumb.width;
    const moved = point.x - held.start;
    const left =
      travel > 0 ? held.offset + (moved * layout.maxScrollLeft) / travel : 0;
    host.scrollContentTo(scrollTop, left);
  };

  return {
    pointOf,

    pointerdown(event) {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      // An Apple platform makes Ctrl with the main button a right click, and
      // its contextmenu follows, so the press selects and drags nothing.
      if (apple && event.ctrlKey) return;

      const point = pointOf(event);
      const { state } = scene;
      const hit = hitTest(state, point);
      const mods = selectionModifiers(event, apple);
      const selection = host.selection();
      const { pointerId } = event;

      // A drag still held here lost its pointerup, as to a native menu, so it
      // ends as a cancelled one: a resize drops the width it drew.
      cancel();

      switch (hit.kind) {
        case 'cell':
          host.select(
            clickCell(selection, { row: hit.row, col: hit.col }, mods)
          );
          drag = { kind: 'cells', pointerId, point };
          break;
        case 'column':
          host.select(clickColumnHeader(selection, hit.col, mods, bounds()));
          drag = { kind: 'columns', pointerId, point };
          break;
        case 'row':
          host.select(clickRowHeader(selection, hit.row, mods, bounds()));
          drag = { kind: 'rows', pointerId, point };
          break;
        case 'corner':
          host.select(clickCorner(selection, mods, bounds()));
          return;
        case 'edge': {
          const width = state.offsets[hit.col + 1] - state.offsets[hit.col];
          drag = {
            kind: 'resize',
            pointerId,
            col: hit.col,
            startX: point.x,
            startWidth: width,
            width,
          };
          break;
        }
        case 'thumb':
          drag = {
            kind: 'thumb',
            pointerId,
            axis: hit.axis,
            start: hit.axis === 'vertical' ? point.y : point.x,
            offset:
              hit.axis === 'vertical' ? state.scrollTop : state.scrollLeft,
          };
          break;
        case 'track':
          pageTrack(hit.axis, hit.direction);
          return;
        default:
          return;
      }

      capture(pointerId);
    },

    pointermove(event) {
      const point = pointOf(event);

      if (!drag) {
        if (event.pointerType === 'touch') return;
        const hit = hitTest(scene.state, point);
        setCursor(hit.kind === 'edge' ? RESIZE_CURSOR : '');
        return;
      }

      if (event.pointerId !== drag.pointerId) return;
      // The button went up where no pointerup reached the scroller, as when a
      // native menu took it, so the drag ends as a cancelled one does.
      if ((event.buttons & 1) === 0) {
        cancel();
        return;
      }

      switch (drag.kind) {
        case 'resize':
          drag.width = clampColumnWidth(
            drag.startWidth + point.x - drag.startX
          );
          scene.setResize({ col: drag.col, width: drag.width });
          break;
        case 'thumb':
          moveThumb(drag, point);
          break;
        default:
          drag.point = point;
          extend(drag);
          autoScroll(drag);
      }
    },

    pointerup(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;

      const ended = drag;
      stop();

      if (ended.kind !== 'resize') return;

      scene.setResize(null);
      if (ended.width !== ended.startWidth) {
        host.columnResized(ended.col, ended.width);
      }
    },

    pointercancel(event) {
      if (drag && event.pointerId === drag.pointerId) cancel();
    },

    dblclick(event) {
      const hit = hitTest(scene.state, pointOf(event));

      if (hit.kind === 'cell') {
        host.cellDoubleClicked({ row: hit.row, col: hit.col });
        return;
      }
      if (hit.kind !== 'edge') return;

      const { offsets } = scene.state;
      const width = fitWidth(scene, hit.col);
      if (width !== offsets[hit.col + 1] - offsets[hit.col]) {
        host.columnResized(hit.col, width);
      }
    },

    dispose: stop,
  };
}
