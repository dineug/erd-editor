import { query } from '@dineug/erd-editor-schema';

import {
  getColumnCellSlots,
  getHeaderCellSlots,
  HEADER_CELLS_X,
} from '@/components/erd/canvas/table/cellLayout';
import { coveredWidth } from '@/components/find-replace/panelLayout';
import { CanvasType, Show } from '@/constants/schema';
import type { EngineContext } from '@/engine/context';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  focusColumnAction,
  focusTableAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import {
  changeCanvasTypeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { changeZIndexAction } from '@/engine/modules/table/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import type { Table } from '@/internal-types';
import {
  getColumnRect,
  getMemoRect,
  getTableHeaderRect,
  getTableRect,
  getTableWidths,
  type Rect,
} from '@/konva/scene/metrics';
import { getOriginToPlace, toScreenPoint } from '@/konva/scene/viewport';
import { nextZIndex } from '@/utils';
import { bHas } from '@/utils/bit';
import { isHighLevelTable } from '@/utils/validation';

/** The part of a cell's text a jump is for, a search's match say: text from start to end. */
export type TextRange = { text: string; start: number; end: number };

/** What a jump to the ERD lands on: a table, one cell of a column, or a memo. */
export type ErdTarget =
  | {
      kind: 'table';
      tableId: string;
      focusType?: FocusType;
      range?: TextRange;
    }
  | {
      kind: 'column';
      tableId: string;
      columnId: string;
      focusType: FocusType;
      range?: TextRange;
    }
  | { kind: 'memo'; memoId: string };

/** How far in from the edge of the screen a jump keeps what it shows of a rect too long for it. */
const EDGE_MARGIN = 40;

type Span = { start: number; end: number };

/** The rect where the screen shows it, at the document's own placement, one span an axis. */
function toScreenSpans({ settings }: RootState, rect: Rect): [Span, Span] {
  const topLeft = toScreenPoint(settings, rect);
  const bottomRight = toScreenPoint(settings, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });

  return [
    { start: topLeft.x, end: bottomRight.x },
    { start: topLeft.y, end: bottomRight.y },
  ];
}

const isWithin = (span: Span, from: number, to: number) =>
  span.start >= from && span.end <= to;

/**
 * Where on one axis of the screen the rect is to start: its middle on the
 * middle of the span shown, or, when it is longer than that span, as near that
 * as keeps its focus a margin inside the span.
 */
function placeOnAxis(rect: Span, focus: Span, from: number, to: number) {
  const length = rect.end - rect.start;
  let start = (from + to - length) / 2;
  if (length <= to - from) return start;

  const offset = focus.start - rect.start;
  const focusLength = focus.end - focus.start;
  start = Math.min(start, to - EDGE_MARGIN - offset - focusLength);
  // The focus's start wins over its end when it is too long to show whole.
  return Math.max(start, from + EDGE_MARGIN - offset);
}

/**
 * The scroll that puts the rect in the middle of what the screen shows at the
 * document's own zoom, unless it is shown whole already, since that scroll is
 * the one change of a jump the host hears of.
 *
 * @param focus The part of a rect too big for the screen that has to show.
 */
export function* scrollIntoView(
  state: RootState,
  rect: Rect,
  covered = 0,
  focus = rect
) {
  const { width, height } = state.editor.viewport;
  const [rectX, rectY] = toScreenSpans(state, rect);
  const [focusX, focusY] = toScreenSpans(state, focus);
  const fits =
    rectX.end - rectX.start <= width - covered &&
    rectY.end - rectY.start <= height;
  const [shownX, shownY] = fits ? [rectX, rectY] : [focusX, focusY];
  if (isWithin(shownX, covered, width) && isWithin(shownY, 0, height)) return;

  const origin = getOriginToPlace(state.settings.zoomLevel, rect, {
    x: placeOnAxis(rectX, focusX, covered, width),
    y: placeOnAxis(rectY, focusY, 0, height),
  });
  yield scrollToAction({ originX: origin.x, originY: origin.y });
}

/**
 * Where a table shows its name: the band across its top, or, at a zoom far
 * enough out that the name is all a table draws, the middle of its box.
 */
function getTableNameRect(state: RootState, table: Table): Rect {
  const header = getTableHeaderRect(state, table);
  if (!isHighLevelTable(state.settings.zoomLevel)) return header;

  const { y, height } = getTableRect(state, table);
  return { ...header, y: y + (height - header.height) / 2 };
}

/**
 * Where a range of a cell's text starts and ends, in from the cell's left
 * edge, measured as the cell's own width was. The measure pads a text, which
 * the cell draws none of, so the empty text's width comes off.
 */
function measureRange({ toWidth }: EngineContext, range: TextRange): Span {
  const at = (index: number) =>
    toWidth(range.text.slice(0, index)) - toWidth('');

  return { start: at(range.start), end: at(range.end) };
}

/**
 * The part of a cell its range covers, cut at the cell's right edge, where the
 * text is cut off, while the cell is too wide to show whole a margin inside the
 * canvas left clear; null for a cell that fits, which shows the range itself.
 */
function getRangeRect(
  state: RootState,
  cell: Rect,
  covered: number,
  range?: Span
): Rect | null {
  const [cellX] = toScreenSpans(state, cell);
  const clear = state.editor.viewport.width - covered - EDGE_MARGIN * 2;
  if (!range || cellX.end - cellX.start <= clear) return null;

  const start = Math.min(range.start, cell.width);
  return {
    ...cell,
    x: cell.x + start,
    width: Math.min(range.end, cell.width) - start,
  };
}

/**
 * Where a table shows the cell a jump rings in its header: its comment, or
 * else its name, the band a selection rings, or in either the range found,
 * for a cell too wide to show whole.
 */
function getTableFocusRect(
  state: RootState,
  table: Table,
  focusType: FocusType,
  covered: number,
  range?: Span
): Rect {
  const name = getTableNameRect(state, table);
  if (isHighLevelTable(state.settings.zoomLevel)) return name;

  const slot = getHeaderCellSlots(state, table).find(
    candidate => candidate.focusType === focusType
  );
  if (!slot) return name;

  const cell = {
    ...name,
    x: name.x + HEADER_CELLS_X + slot.x,
    width: slot.width,
  };
  const found = getRangeRect(state, cell, covered, range);
  if (found) return found;
  return focusType === FocusType.tableComment ? cell : name;
}

/**
 * Brings a table on screen whole, or one too big for the screen by the header
 * cell a jump rings, its name unless it asks for the comment, rather than by
 * a middle.
 *
 * @param range Where the text a jump is for stands in that cell, in from its left edge.
 */
export function* scrollTableIntoView(
  state: RootState,
  table: Table,
  covered = 0,
  focusType: FocusType = FocusType.tableName,
  range?: Span
) {
  yield* scrollIntoView(
    state,
    getTableRect(state, table),
    covered,
    getTableFocusRect(state, table, focusType, covered, range)
  );
}

/**
 * The one cell of a column row a jump rings, as the cell editor lays it out,
 * so a row too wide for the screen is scrolled to by that cell, or by the
 * range found in it when the cell is too wide as well.
 */
function getColumnFocusRect(
  state: RootState,
  table: Table,
  index: number,
  focusType: FocusType,
  covered: number,
  range?: Span
): Rect {
  const row = getColumnRect(state, table, index);
  const slot = getColumnCellSlots(state, getTableWidths(state, table)).find(
    candidate => candidate.focusType === focusType
  );
  if (!slot) return row;

  const cell = {
    ...row,
    x: getTableRect(state, table).x + slot.x,
    width: slot.width,
  };
  return getRangeRect(state, cell, covered, range) ?? cell;
}

/**
 * The cell a comment is found in, or the name beside it while the comments
 * are hidden, so the focus ring never lands on a cell nobody can see.
 */
function visibleFocusType(state: RootState, focusType: FocusType): FocusType {
  const { show } = state.settings;

  if (focusType === FocusType.tableComment) {
    return bHas(show, Show.tableComment) ? focusType : FocusType.tableName;
  }
  if (focusType === FocusType.columnComment) {
    return bHas(show, Show.columnComment) ? focusType : FocusType.columnName;
  }
  return focusType;
}

/**
 * Selects the table alone and brings it to the front, as a press on it does,
 * bar the press's part in a relationship being drawn: a jump only shows, so it
 * never starts or finishes one, which would add a relationship and a column.
 */
export const selectTableAloneAction$ = (tableId: string): GeneratorAction =>
  function* ({ doc, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(doc.memoIds);

    yield unselectAllAction();
    yield selectAction({ [tableId]: SelectType.table });
    yield changeZIndexAction({
      id: tableId,
      zIndex: nextZIndex(tables, memos),
    });
    yield focusTableAction({ tableId });
  };

/**
 * The range of a target measured, for the cell it was found in alone: one
 * found in a hidden comment says nothing of the name ringed in its place.
 */
function rangeIn(
  ctx: EngineContext,
  { range, focusType }: { range?: TextRange; focusType?: FocusType },
  ringed: FocusType
): Span | undefined {
  return range && focusType === ringed ? measureRange(ctx, range) : undefined;
}

/**
 * Stands the reader on a table, a column cell or a memo the way the Go to ERD
 * button stands them on a table, with the focus ring on the cell asked for. A
 * row too wide goes by the ringed cell, a cell too wide by the range found.
 *
 * @param covered How far in from the left edge a panel over the canvas hides it.
 */
export const showErdTargetAction$ = (
  target: ErdTarget,
  covered = 0
): GeneratorAction =>
  function* (state, ctx) {
    if (target.kind === 'memo') {
      const memo = query(state.collections)
        .collection('memoEntities')
        .selectById(target.memoId);
      if (!memo) return;

      yield* scrollIntoView(state, getMemoRect(memo), covered);
      yield selectMemoAction$(memo.id, false);
      return;
    }

    const table = query(state.collections)
      .collection('tableEntities')
      .selectById(target.tableId);
    if (!table) return;

    if (target.kind === 'table') {
      const focusType = target.focusType
        ? visibleFocusType(state, target.focusType)
        : FocusType.tableName;
      yield* scrollTableIntoView(
        state,
        table,
        covered,
        focusType,
        rangeIn(ctx, target, focusType)
      );
      yield selectTableAloneAction$(table.id);
      if (target.focusType) {
        yield focusTableAction({ tableId: table.id, focusType });
      }
      return;
    }

    const index = table.columnIds.indexOf(target.columnId);
    if (index === -1) return;

    const focusType = visibleFocusType(state, target.focusType);
    // Zoomed out far enough, a table is drawn as its name alone.
    if (isHighLevelTable(state.settings.zoomLevel)) {
      yield* scrollTableIntoView(state, table, covered);
    } else {
      yield* scrollIntoView(
        state,
        getColumnRect(state, table, index),
        covered,
        getColumnFocusRect(
          state,
          table,
          index,
          focusType,
          covered,
          rangeIn(ctx, target, focusType)
        )
      );
    }
    yield selectTableAloneAction$(table.id);
    yield focusColumnAction({
      tableId: table.id,
      columnId: target.columnId,
      focusType,
      $mod: false,
      shiftKey: false,
    });
  };

/**
 * Takes the ERD tab when another is up, in a dispatch of its own: a batch is
 * classified by the state before it, so a scroll travelling with the tab
 * change would be redirected into the view it leaves.
 */
export function showErdTab(store: RxStore): void {
  if (store.state.settings.canvasType !== CanvasType.ERD) {
    store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
  }
}

/**
 * A jump from outside the canvas, a search result say, to anything it holds,
 * from whichever tab is up. It lands clear of the Find and Replace panel, read
 * once the ERD tab is up, so a panel that tab draws again counts too.
 *
 * @example
 * goToErdTarget(store, { kind: 'memo', memoId: 'note' });
 */
export function goToErdTarget(store: RxStore, target: ErdTarget): void {
  showErdTab(store);
  store.dispatchSync(showErdTargetAction$(target, coveredWidth(store.state)));
}
