import {
  createRef,
  type FC,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from '@dineug/r-html';
import { markDirty, renderKonva } from '@dineug/r-html-konva';
import { Stage } from 'konva/lib/Stage';

import { DEFAULT_FONT } from '@/font';
import {
  type CommitEvent,
  createEditingInput,
  type GridColumn,
  holdInside,
  type Insets,
  type OpenEditor,
  placeEditor,
  type RejectEvent,
} from '@/input/editing';
import {
  cellArea,
  cellRect,
  createPointerInput,
  hitTest,
  type PointerInput,
  scrollsWithin,
  wheelScroll,
} from '@/input/pointer';
import { isApplePlatform, keyAction } from '@/model/keys';
import {
  clickCell,
  isSelected,
  moveActive,
  type NavigationKey,
  selectCell,
  type SelectModifiers,
} from '@/model/selection';
import type { CellRef, CellStyle, GridSelection } from '@/model/types';
import { DEFAULT_ROW_HEIGHT, scrollMapping } from '@/model/viewport';
import { baselineOffset, CELL_PADDING } from '@/scene/draw/context';
import { renderGridScene } from '@/scene/GridScene';
import { type SceneRect, SCROLLBAR_SIZE } from '@/scene/layout';
import { createSceneState, type SceneData } from '@/scene/state';
import { type GridTheme, lightTheme } from '@/theme';

export type {
  CommitEvent,
  EditorContext,
  GridColumn,
  RejectEvent,
} from '@/input/editing';

/**
 * The cells in view with no overscan, every end inclusive and an end one short
 * of its start when nothing shows. While a frozen column shows, the columns
 * count from the first, the frozen ones included.
 */
export interface ViewportChange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

/** A right click on a cell, at the client point the host opens its menu at. */
export interface CellContextMenuEvent {
  row: number;
  col: number;
  clientX: number;
  clientY: number;
}

/** The commands a host keeps from onReady, valid until the grid unmounts. */
export interface GridHandle {
  /** Scrolls the least distance that shows the cell. */
  scrollTo(row: number, col: number): void;
  /** Replaces the selection; the host made the change, so onSelectionChange does not echo it. */
  select(selection: GridSelection): void;
  /** Moves the keyboard focus into the grid. */
  focus(): void;
}

/**
 * A grid's props. It holds no cell: it reads rowCount, columns and getCell,
 * draws only the cells in view, and asks the host for every change through
 * onCommit. Raising version reads every cell in view again.
 */
export interface GridProps {
  rowCount: number;
  columns: readonly GridColumn[];
  getCell(row: number, col: number): string;
  getCellStyle?(row: number, col: number): CellStyle | undefined;
  rowHeight?: number;
  frozenColumns?: number;
  theme?: Readonly<GridTheme>;
  /** A CSS font shorthand; the default is the editor canvas's stack at 13px. */
  font?: string;
  version?: number;
  /** The accessible name of the focus textarea, the one element that takes the keyboard. */
  ariaLabel?: string;
  /** Every edit, paste or clear, one request per action; the grid writes no cell itself. */
  onCommit?(event: CommitEvent): void;
  /** A copy or a paste the grid turned down, in whole or in part. */
  onReject?(event: RejectEvent): void;
  onSelectionChange?(selection: GridSelection): void;
  /** A column resized by a drag, once it ends, or fit to its visible rows by a double click. */
  onColumnResize?(col: number, width: number): void;
  onViewportChange?(viewport: ViewportChange): void;
  /** Given, a right click on a cell opens no native menu and hands its point here. */
  onCellContextMenu?(event: CellContextMenuEvent): void;
  /** Called once the grid has mounted, with the commands it takes. */
  onReady?(handle: GridHandle): void;
}

const CONTAINER_CLASS = 'dineug-grid';

const SCROLLER_CLASS = 'dineug-grid-scroller';

/**
 * The container clips, since a box that only hides its overflow still scrolls
 * to a caret past its edge; the native scrollbars go both ways, scrollbar-width
 * and, for chrome91 and Safari, the WebKit pseudo element.
 */
const GRID_CSS = `.${CONTAINER_CLASS}{overflow:hidden;overflow:clip}.${SCROLLER_CLASS}{scrollbar-width:none}.${SCROLLER_CLASS}::-webkit-scrollbar{display:none}`;

const CONTAINER_STYLE = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

const STAGE_STYLE = {
  position: 'absolute',
  left: '0',
  top: '0',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

/**
 * The scroller takes every pointer, wheel and touch scroll over the stage.
 * It is out of the tab order, since Firefox and recent Chrome tab into a
 * scroller with no focusable child and its arrows would scroll natively.
 */
const SCROLLER_STYLE = {
  position: 'absolute',
  inset: '0',
  overflow: 'auto',
  'overscroll-behavior': 'contain',
  outline: 'none',
};

/**
 * The focus textarea, invisible and transparent to the pointer while no edit
 * is open. It is hidden by opacity, never display or visibility, which would
 * blur it and end an IME composition.
 */
const FOCUS_STYLE = {
  position: 'absolute',
  margin: '0',
  padding: '0',
  border: '0',
  outline: 'none',
  resize: 'none',
  overflow: 'hidden',
  'box-sizing': 'border-box',
  'white-space': 'pre',
  background: 'transparent',
  opacity: '0',
  'pointer-events': 'none',
  'caret-color': 'transparent',
};

/** The custom editor slot, empty and sizeless until an editor opens in it. */
const SLOT_STYLE = {
  position: 'absolute',
  left: '0',
  top: '0',
  width: '0',
  height: '0',
};

/**
 * The grid's own editor fills what the active cell's 2px edge leaves of the
 * cell: the edge takes the line before the cell and its first pixel on the
 * left and top, and the cell's last two pixels on the right and bottom.
 */
const EDITOR_INSETS: Readonly<Insets> = Object.freeze({
  left: 1,
  top: 1,
  right: 2,
  bottom: 2,
});

const STRICT = Object.freeze({ rows: 0, cols: 0 });

const px = (value: number) => `${value}px`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const boxStyle = (box: SceneRect) => ({
  left: px(box.x),
  top: px(box.y),
  width: px(box.width),
  height: px(box.height),
});

/**
 * The focus textarea's style: invisible over the active cell, held inside the
 * cell area, or, as the open editor, over its cell with the cell's text where
 * the cell draws it, hidden by opacity alone once the cell leaves the view.
 */
function focusStyle(
  state: Readonly<SceneData>,
  open: OpenEditor | null,
  font: string
) {
  if (!open || open.custom) {
    const box = holdInside(
      cellRect(state, state.selection.active),
      cellArea(state)
    );
    return { ...FOCUS_STYLE, ...boxStyle(box), font };
  }

  const { box, clip, shown } = placeEditor(state, open.cell, EDITOR_INSETS);
  const color = open.style?.color ?? state.theme.text;
  const { ascent, descent } = state.metrics;
  // A line exactly the font's height has no leading for CSS to round, so the
  // padding above it puts the baseline on the pixel the canvas draws it on.
  const top = baselineOffset(state.rowHeight, state.metrics) - ascent;

  return {
    ...FOCUS_STYLE,
    ...boxStyle(box),
    font,
    padding: `${px(Math.max(0, top - EDITOR_INSETS.top))} ${px(CELL_PADDING - EDITOR_INSETS.left)} 0`,
    'line-height': px(ascent + descent),
    background: open.style?.background ?? state.theme.background,
    color,
    'caret-color': color,
    opacity: shown ? '1' : '0',
    'pointer-events': shown ? 'auto' : 'none',
    'clip-path': clip
      ? `inset(${px(clip.top)} ${px(clip.right)} ${px(clip.bottom)} ${px(clip.left)})`
      : 'none',
  };
}

/** The slot's style: sizeless, or over the cell a column's own editor opened on. */
function slotStyle(state: Readonly<SceneData>, open: OpenEditor | null) {
  if (!open?.custom) return SLOT_STYLE;

  const { box, shown } = placeEditor(state, open.cell);

  return {
    ...SLOT_STYLE,
    ...boxStyle(box),
    opacity: shown ? '1' : '0',
    'pointer-events': shown ? 'auto' : 'none',
  };
}

/** The corner of the last range across from the active cell, the one Shift moves. */
function farCorner(selection: GridSelection): CellRef {
  const { active, ranges } = selection;
  const range = ranges[ranges.length - 1];
  if (!range) return active;

  const far = (anchor: number, start: number, end: number) =>
    anchor - start > end - anchor ? start : end;

  return {
    row: far(active.row, range.startRow, range.endRow),
    col: far(active.col, range.startCol, range.endCol),
  };
}

const sameViewport = (a: ViewportChange, b: ViewportChange) =>
  a.rowStart === b.rowStart &&
  a.rowEnd === b.rowEnd &&
  a.colStart === b.colStart &&
  a.colEnd === b.colEnd;

/**
 * The spreadsheet grid: a Konva stage under a transparent DOM scroller for the
 * pointer and the wheel, and a focus textarea over the active cell for the
 * keyboard, which becomes the editor unless a column opens its own in the slot.
 *
 * @example
 * render(host, <Grid rowCount={rows.length} columns={columns} getCell={getCell} />);
 */
export const Grid: FC<GridProps> = props => {
  const containerRef = createRef<HTMLDivElement>();
  const stageRef = createRef<HTMLDivElement>();
  const scrollerRef = createRef<HTMLDivElement>();
  const spacerRef = createRef<HTMLDivElement>();
  const focusRef = createRef<HTMLTextAreaElement>();
  const slotRef = createRef<HTMLDivElement>();
  const apple = isApplePlatform(navigator.platform);

  let selection: GridSelection = selectCell({ row: 0, col: 0 });
  const scene = createSceneState({
    rowCount: props.rowCount,
    columns: props.columns,
    getCell: props.getCell,
    getCellStyle: props.getCellStyle,
    frozenColumns: props.frozenColumns,
    rowHeight: props.rowHeight,
    theme: props.theme,
    font: props.font,
    version: props.version,
    selection,
  });

  const disposers: Array<() => void> = [];
  let mounted = false;
  let pointer: PointerInput | null = null;
  let lastPointerType = '';
  /** The scroll mapping's ratio the DOM scroll offsets were last written under. */
  let ratio = 0;
  /** The DOM offset a content offset was written as, so reading it back loses no precision. */
  let held: { dom: number; content: number } | null = null;
  /** Whether the scroller dropped the offsets last written to it, as one display: none does, so they are written again. */
  let unsynced = false;
  let viewportFrame = 0;
  let viewport: ViewportChange | null = null;
  let resolution: MediaQueryList | null = null;

  /** Takes a gesture's result: a new selection reaches the scene and the host once. */
  const changeSelection = (next: GridSelection) => {
    if (next === selection) return;

    selection = next;
    scene.setSelection(next);
    props.onSelectionChange?.(next);
  };

  /** Whether a press lands on a scrollbar, which an open edit stays open through. */
  const onScrollbar = (event: PointerEvent) => {
    const scroller = scrollerRef.value;
    if (!pointer || !scroller || !event.composedPath().includes(scroller)) {
      return false;
    }

    const hit = hitTest(scene.state, pointer.pointOf(event));
    return hit.kind === 'thumb' || hit.kind === 'track';
  };

  const editing = createEditingInput({
    scene,
    get textarea() {
      return focusRef.value;
    },
    get slot() {
      return slotRef.value;
    },
    columns: () => props.columns,
    selection: () => selection,
    onScrollbar,
    move: (key, mods) => navigate(key, mods),
    commit: event => props.onCommit?.(event),
    reject: event => props.onReject?.(event),
  });

  const reportViewport = () => {
    viewportFrame = 0;

    const range = scene.visibleRange(STRICT);
    const next: ViewportChange = {
      rowStart: range.rowStart,
      rowEnd: range.rowEnd,
      colStart: range.frozenEnd >= 0 ? 0 : range.colStart,
      colEnd: range.colEnd >= range.colStart ? range.colEnd : range.frozenEnd,
    };
    if (viewport && sameViewport(viewport, next)) return;

    viewport = next;
    props.onViewportChange?.(next);
  };

  /** Reports the cells in view on the next frame, once however many changes moved them. */
  const scheduleViewport = () => {
    if (viewportFrame || !mounted) return;
    viewportFrame = requestAnimationFrame(reportViewport);
  };

  /**
   * Sizes the spacer to the scroll range: the stage plus what scrolls past it,
   * the rows scaled once they outgrow the cap. A scrollbar strip the layout
   * keeps out of the cell area adds itself, so the last row clears it.
   */
  const writeSpacer = () => {
    const spacer = spacerRef.value;
    const { layout } = scene.state;
    const mapping = scrollMapping(layout.contentHeight);
    const bar = layout.horizontalBar ? SCROLLBAR_SIZE : 0;
    const width = px(layout.width + layout.maxScrollLeft);
    const height = px(
      layout.headerHeight + mapping.domHeight(layout.cellHeight) + bar
    );

    if (spacer && spacer.style.width !== width) spacer.style.width = width;
    if (spacer && spacer.style.height !== height) spacer.style.height = height;

    return mapping;
  };

  /** Whether an element has a box, which one under display: none has not. */
  const rendered = (element: HTMLElement) =>
    element.getClientRects().length > 0;

  /** Writes the scene's scroll offsets to the DOM scroller, which follows the content. */
  const pushScroll = () => {
    const scroller = scrollerRef.value;
    const mapping = writeSpacer();
    if (!scroller) return;

    const { layout, scrollTop, scrollLeft } = scene.state;
    const domTop = mapping.toDom(scrollTop, layout.cellHeight);

    if (Math.abs(scroller.scrollTop - domTop) >= 0.5) {
      scroller.scrollTop = domTop;
    }
    if (scroller.scrollLeft !== scrollLeft) scroller.scrollLeft = scrollLeft;

    // A scroller that is not rendered keeps no offset and reads 0, so the
    // content offsets wait for the next layout or scroll to be written again.
    unsynced =
      (Math.abs(scroller.scrollTop - domTop) >= 0.5 ||
        Math.abs(scroller.scrollLeft - scrollLeft) >= 0.5) &&
      !rendered(scroller);
    held = unsynced ? null : { dom: scroller.scrollTop, content: scrollTop };
  };

  /** Reads the DOM scroller into the scene, as a scroll event does. */
  const pullScroll = () => {
    const scroller = scrollerRef.value;
    if (!scroller) return;

    const { layout } = scene.state;
    const domTop = scroller.scrollTop;
    const top =
      held && Math.abs(domTop - held.dom) < 0.5
        ? held.content
        : scrollMapping(layout.contentHeight).toContent(
            domTop,
            layout.cellHeight
          );

    scene.setScroll(top, scroller.scrollLeft);
    scheduleViewport();
  };

  /**
   * A new layout: the spacer follows it, and the scroll follows the DOM unless
   * the rows' scale changed, when the content offset stays and the DOM moves.
   * A scroller under display: none reads 0, so the content offset stays too.
   */
  const onLayout = () => {
    const next = scrollMapping(scene.state.layout.contentHeight).ratio;
    const scroller = scrollerRef.value;

    if (next !== ratio || unsynced) {
      ratio = next;
      pushScroll();
    } else if (scroller && !rendered(scroller)) {
      writeSpacer();
      unsynced = true;
      held = null;
    } else {
      writeSpacer();
      pullScroll();
    }
    scheduleViewport();
  };

  /** A scroll event: the DOM scroller read into the scene, unless it lost the offsets the scene wrote, which go back first. */
  const onScroll = () => (unsynced ? pushScroll() : pullScroll());

  const scrollContentTo = (top: number, left: number) => {
    scene.setScroll(top, left);
    pushScroll();
    scheduleViewport();
  };

  /** Scrolls the least distance that shows a cell; a frozen column needs no horizontal scroll. */
  const reveal = (cell: CellRef) => {
    const { layout, offsets, rowHeight, scrollTop, scrollLeft } = scene.state;
    let top = scrollTop;
    let left = scrollLeft;
    const rowTop = cell.row * rowHeight;

    if (rowTop < top || layout.cellHeight < rowHeight) {
      top = rowTop;
    } else if (rowTop + rowHeight > top + layout.cellHeight) {
      top = rowTop + rowHeight - layout.cellHeight;
    }

    if (cell.col >= layout.frozenCount && cell.col < offsets.length - 1) {
      const colLeft = offsets[cell.col] - layout.scrollOrigin;
      const colRight = offsets[cell.col + 1] - layout.scrollOrigin;
      const span = layout.body.width;

      if (colLeft < left || colRight - colLeft > span) {
        left = colLeft;
      } else if (colRight > left + span) {
        left = colRight - span;
      }
    }

    if (top !== scrollTop || left !== scrollLeft) scrollContentTo(top, left);
  };

  /** The rows one screen holds whole, the step of PageUp and PageDown. */
  const pageRows = () =>
    Math.max(
      1,
      Math.floor(scene.state.layout.cellHeight / scene.state.rowHeight)
    );

  /**
   * A navigation key: the selection moves as the model says, and the cell
   * that moved scrolls into view, the far corner under Shift. A page key
   * scrolls the rows it moved first, so the cell keeps its place on screen.
   */
  const navigate = (key: NavigationKey, mods: SelectModifiers) => {
    const { state } = scene;
    const before = selection;
    const bounds = { rowCount: state.rowCount, colCount: state.columns.length };
    const next = moveActive(before, key, mods, bounds, pageRows());

    changeSelection(next);
    if (key === 'SelectAll') return;

    const extended = Boolean(mods.shift) && key !== 'Tab' && key !== 'Enter';
    const target = extended ? farCorner(next) : next.active;

    if (key === 'PageUp' || key === 'PageDown') {
      const from = extended ? farCorner(before) : before.active;
      scrollContentTo(
        state.scrollTop + (target.row - from.row) * state.rowHeight,
        state.scrollLeft
      );
    }

    reveal(target);
  };

  /**
   * The textarea's keys, read as an open editor's while an edit is open. A
   * key the grid acts on is prevented, never stopped; any other, which
   * keyAction answers null for, reaches the textarea and the host as it is.
   */
  const onKeyDown = (event: KeyboardEvent) => {
    const action = keyAction(event, { apple, editing: editing.editing() });
    if (!action) return;

    event.preventDefault();
    if (action.type === 'move') {
      navigate(action.key, action.mods);
    } else {
      editing.act(action, event.key);
    }
  };

  /**
   * A wheel over the textarea, or over the editor slot, which lie beside the
   * scroller rather than in it, so the scroll reaches it by hand. Ctrl with a
   * wheel is a pinch zoom, left to the browser, and a prevented one scrolls nothing.
   */
  const forwardWheel = (event: WheelEvent) => {
    const scroller = scrollerRef.value;
    if (!scroller || event.ctrlKey || event.defaultPrevented) return;

    event.preventDefault();
    const { rowHeight, layout } = scene.state;
    scroller.scrollBy(wheelScroll(event, rowHeight, layout.cellHeight));
  };

  /** One tuple for every render, so the template never rebinds the listener; non-passive, to prevent the page's scroll. */
  const wheelListener = [forwardWheel, { passive: false }] as const;

  /** A wheel over a column's own editor, which an element in it that prevented it or can still scroll that way keeps. */
  const slotWheel = (event: WheelEvent) => {
    const slot = slotRef.value;
    if (!slot || event.ctrlKey || event.defaultPrevented) return;

    const { rowHeight, layout } = scene.state;
    const delta = wheelScroll(event, rowHeight, layout.cellHeight);
    if (!scrollsWithin(event.composedPath(), slot, delta)) forwardWheel(event);
  };

  const slotWheelListener = [slotWheel, { passive: false }] as const;

  /** The slot's blur, in the capture phase, so an editor that commits from its own blur finds where the focus is going. */
  const slotBlurListener = [editing.slotBlur, { capture: true }] as const;

  const onPointerDown = (event: PointerEvent) => {
    lastPointerType = event.pointerType;
    pointer?.pointerdown(event);
  };

  const onPointerMove = (event: PointerEvent) => pointer?.pointermove(event);

  const onPointerUp = (event: PointerEvent) => pointer?.pointerup(event);

  const onPointerCancel = (event: PointerEvent) =>
    pointer?.pointercancel(event);

  /** A double click fits a column at its header edge or opens a cell's editor; a double tap does neither. */
  const onDoubleClick = (event: MouseEvent) => {
    if (lastPointerType !== 'touch') pointer?.dblclick(event);
  };

  /**
   * Focus and text selection are a mousedown's defaults, so preventing it
   * keeps the focus where it is; the pointerdown before it stays uncancelled,
   * since that would stop the mousedown. A tap leaves the focus alone.
   */
  const onMouseDown = (event: MouseEvent) => {
    if (lastPointerType === 'touch') return;

    event.preventDefault();
    // A column's own editor keeps the focus it holds until its edit closes,
    // which hands the focus back to the textarea.
    if (!editing.holdsFocus()) focusRef.value?.focus({ preventScroll: true });
  };

  /**
   * A right click on a cell, while the host takes them: outside the selection
   * it moves the active cell there first, and no native menu opens.
   */
  const onContextMenu = (event: MouseEvent) => {
    const listener = props.onCellContextMenu;
    if (!listener || !pointer) return;

    const hit = hitTest(scene.state, pointer.pointOf(event));
    if (hit.kind !== 'cell') return;

    event.preventDefault();
    const cell = { row: hit.row, col: hit.col };
    if (!isSelected(selection, cell)) {
      changeSelection(clickCell(selection, cell));
    }
    listener({
      row: cell.row,
      col: cell.col,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  /**
   * A menu the keyboard opens, with Shift+F10 or the menu key, which fires on
   * the focused textarea: while no edit is open and the host takes them, the
   * host's menu opens on the active cell, at the middle of where it shows.
   */
  const onKeyboardContextMenu = (event: MouseEvent) => {
    const listener = props.onCellContextMenu;
    const container = containerRef.value;
    const { state } = scene;
    const { active } = selection;
    if (!listener || !container || editing.editing()) return;
    if (active.row >= state.rowCount || active.col >= state.columns.length) {
      return;
    }

    event.preventDefault();
    const box = holdInside(cellRect(state, active), cellArea(state));
    const rect = container.getBoundingClientRect();
    listener({
      row: active.row,
      col: active.col,
      clientX: rect.left + box.x + box.width / 2,
      clientY: rect.top + box.y + box.height / 2,
    });
  };

  /** Draws each layer at the screen's pixel ratio, which konva read once as it loaded. */
  const applyPixelRatio = () => {
    const next = window.devicePixelRatio || 1;

    for (const layer of [scene.layers.body, scene.layers.overlay]) {
      if (!layer || layer.getCanvas().getPixelRatio() === next) continue;

      layer.getCanvas().setPixelRatio(next);
      markDirty(layer);
    }
  };

  /** A query for the ratio now, which stops matching once the window moves to another screen. */
  function watchResolution() {
    resolution?.removeEventListener('change', onResolution);
    resolution = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`
    );
    resolution.addEventListener('change', onResolution);
  }

  function onResolution() {
    applyPixelRatio();
    watchResolution();
  }

  /** A prop the host changed, handed to the scene setter that draws it. */
  const syncProp = (name: PropertyKey) => {
    switch (name) {
      case 'rowCount':
        scene.setRowCount(props.rowCount);
        break;
      case 'columns':
        scene.setColumns(props.columns);
        break;
      case 'getCell':
      case 'getCellStyle':
        scene.setGetters(props.getCell, props.getCellStyle);
        break;
      case 'frozenColumns':
        scene.setFrozenColumns(props.frozenColumns ?? 0);
        break;
      case 'rowHeight':
        scene.setRowHeight(props.rowHeight ?? DEFAULT_ROW_HEIGHT);
        break;
      case 'theme':
        scene.setTheme(props.theme ?? lightTheme);
        break;
      case 'font':
        scene.setFont(props.font ?? DEFAULT_FONT);
        break;
      case 'version':
        scene.setVersion(props.version ?? 0);
        break;
    }
  };

  const handle: GridHandle = {
    scrollTo(row, col) {
      const { rowCount, columns } = scene.state;
      if (!mounted || rowCount < 1 || columns.length < 1) return;

      reveal({
        row: clamp(Math.floor(row) || 0, 0, rowCount - 1),
        col: clamp(Math.floor(col) || 0, 0, columns.length - 1),
      });
    },
    select(next) {
      if (!mounted) return;

      selection = next;
      scene.setSelection(next);
    },
    focus() {
      if (mounted) focusRef.value?.focus({ preventScroll: true });
    },
  };

  onMounted(() => {
    const container = containerRef.value;
    const scroller = scrollerRef.value;

    scene.setSize(container.clientWidth, container.clientHeight);

    const stage = new Stage({
      container: stageRef.value,
      width: scene.state.width,
      height: scene.state.height,
      listening: false,
    });
    renderGridScene(stage, scene);
    applyPixelRatio();
    watchResolution();

    pointer = createPointerInput({
      scene,
      scroller,
      apple,
      selection: () => selection,
      select: changeSelection,
      scrollContentTo,
      syncScroll: pullScroll,
      columnResized: (col, width) => props.onColumnResize?.(col, width),
      cellDoubleClicked: cell => editing.doubleClick(cell),
    });

    ratio = scrollMapping(scene.state.layout.contentHeight).ratio;
    pushScroll();

    const observer = new ResizeObserver(() => {
      scene.setSize(container.clientWidth, container.clientHeight);
    });
    observer.observe(container);

    // The stage goes first, its template torn down before it is destroyed, so
    // the scene's own unmount lets go of its layers and its flush listener.
    disposers.push(
      () => {
        renderKonva(stage, null);
        stage.destroy();
      },
      () => observer.disconnect(),
      () => resolution?.removeEventListener('change', onResolution),
      () => cancelAnimationFrame(viewportFrame),
      () => pointer?.dispose(),
      () => editing.dispose(),
      watch(props).subscribe(syncProp),
      watch(scene.observed).subscribe(name => {
        if (name === 'layout') onLayout();
      })
    );

    mounted = true;
    scheduleViewport();
    props.onReady?.(handle);
  });

  onUnmounted(() => {
    mounted = false;
    disposers.splice(0).forEach(dispose => dispose());
    resolution = null;
    viewportFrame = 0;
    pointer = null;
  });

  return () => {
    // Read through the proxy, so a scroll, a resize, a new selection or an
    // editor opening moves the textarea and the slot.
    const { observed } = scene;
    const { open } = editing.view;

    return (
      <div
        class={CONTAINER_CLASS}
        prop:dir="ltr"
        style={CONTAINER_STYLE}
        use:ref={ref(containerRef)}
      >
        <style prop:textContent={GRID_CSS}></style>
        <div style={STAGE_STYLE} use:ref={ref(stageRef)}></div>
        <div
          class={SCROLLER_CLASS}
          tabindex={-1}
          style={SCROLLER_STYLE}
          use:ref={ref(scrollerRef)}
          on:scroll={onScroll}
          on:pointerdown={onPointerDown}
          on:pointermove={onPointerMove}
          on:pointerup={onPointerUp}
          on:pointercancel={onPointerCancel}
          on:mousedown={onMouseDown}
          on:dblclick={onDoubleClick}
          on:contextmenu={onContextMenu}
        >
          <div use:ref={ref(spacerRef)}></div>
        </div>
        <textarea
          aria-label={props.ariaLabel}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          style={focusStyle(observed, open, props.font ?? DEFAULT_FONT)}
          use:ref={ref(focusRef)}
          on:keydown={onKeyDown}
          on:wheel={wheelListener}
          on:input={editing.input}
          on:compositionstart={editing.compositionstart}
          on:compositionend={editing.compositionend}
          on:copy={editing.copy}
          on:paste={editing.paste}
          on:blur={editing.blur}
          on:contextmenu={onKeyboardContextMenu}
        ></textarea>
        <div
          style={slotStyle(observed, open)}
          use:ref={ref(slotRef)}
          on:keydown={editing.slotKeydown}
          on:wheel={slotWheelListener}
          on:blur={slotBlurListener}
        ></div>
      </div>
    );
  };
};

export default Grid;
