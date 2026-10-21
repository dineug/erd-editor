import { query } from '@dineug/erd-editor-schema';

import {
  getColumnCellSlots,
  getHeaderCellSlots,
  HEADER_CELLS_X,
} from '@/components/erd/canvas/table/cellLayout';
import { TABLE_GROUP_TITLE_HEIGHT } from '@/constants/layout';
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
import { isTableFocusType } from '@/engine/modules/editor/utils/focus';
import {
  getColumnFocusTypes,
  getTableFocusTypes,
  toShownFocusType,
} from '@/engine/modules/editor/utils/nameView';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import {
  changeCanvasTypeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { changeZIndexAction } from '@/engine/modules/table/atom.actions';
import { selectTableGroupAction$ } from '@/engine/modules/table-group/generator.actions';
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
  unionRect,
} from '@/konva/scene/metrics';
import { getOriginToPlace, toScreenPoint } from '@/konva/scene/viewport';
import { nextZIndex } from '@/utils';
import { bHas } from '@/utils/bit';
import { isMemoShown } from '@/utils/memo';
import { getTableGroupRect, isTableGroupShown } from '@/utils/tableGroup';
import { isHighLevelTable } from '@/utils/validation';

/** The part of a cell's text a jump is for, a search's match say: text from start to end. */
export type TextRange = { text: string; start: number; end: number };

/** What a jump to the ERD lands on: a table, one cell of a column, a memo, a relationship or a table group. */
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
  | { kind: 'memo'; memoId: string }
  | { kind: 'relationship'; relationshipId: string }
  | { kind: 'tableGroup'; tableGroupId: string };

/** How far in from the edge of the screen a jump keeps what it shows of a rect too long for it. */
export const EDGE_MARGIN = 40;

/** How near, in screen pixels, a start counts as where it stands, so a jump pressed again moves nothing. */
const STILL = 0.5;

export type Span = { start: number; end: number };

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
 * middle of the axis, or, when it is longer than the axis, as near that as
 * keeps its focus a margin inside.
 */
function placeOnAxis(rect: Span, focus: Span, length: number) {
  const size = rect.end - rect.start;
  let start = (length - size) / 2;
  if (size <= length) return start;

  const offset = focus.start - rect.start;
  const focusLength = focus.end - focus.start;
  start = Math.min(start, length - EDGE_MARGIN - offset - focusLength);
  // The focus's start wins over its end when it is too long to show whole.
  return Math.max(start, EDGE_MARGIN - offset);
}

/**
 * Where a jump starts the rect on one axis, or null to leave it: a short rect
 * keeps its middle in the middle half, a mid one stays while whole or starts a
 * margin down and centred across, and a long one goes by placeOnAxis.
 */
function planAxis(
  rect: Span,
  focus: Span,
  length: number,
  axis: 'x' | 'y'
): number | null {
  const size = rect.end - rect.start;

  if (size <= length / 2) {
    const middle = (rect.start + rect.end) / 2;
    const centred = middle >= length / 4 && middle <= (length * 3) / 4;
    return centred ? null : (length - size) / 2;
  }

  if (size <= length - EDGE_MARGIN * 2) {
    if (isWithin(rect, 0, length)) return null;
    return axis === 'y' ? EDGE_MARGIN : (length - size) / 2;
  }

  const shown = size <= length ? rect : focus;
  return isWithin(shown, 0, length) ? null : placeOnAxis(rect, focus, length);
}

/**
 * The one jump rule every go-to shares: each axis judged on its own, the one
 * that is fine left where it is. Where the rect would start on screen, or null
 * when neither start moves by more than half a pixel, as on a press repeated.
 *
 * @example
 * planJump({ width: 800, height: 600 }, toScreenSpans(state, rect), focusSpans);
 */
export function planJump(
  viewport: { width: number; height: number },
  [rectX, rectY]: [Span, Span],
  [focusX, focusY]: [Span, Span]
): { x: number; y: number } | null {
  const x = planAxis(rectX, focusX, viewport.width, 'x') ?? rectX.start;
  const y = planAxis(rectY, focusY, viewport.height, 'y') ?? rectY.start;
  const still =
    Math.abs(x - rectX.start) < STILL && Math.abs(y - rectY.start) < STILL;
  return still ? null : { x, y };
}

/**
 * The scroll the jump rule asks for to bring the rect into view at the
 * document's own zoom, none when it asks for none, since that scroll is the
 * one change of a jump the host hears of.
 *
 * @param focus The part of a rect too big for the screen that has to show.
 */
export function* scrollIntoView(state: RootState, rect: Rect, focus = rect) {
  const place = planJump(
    state.editor.viewport,
    toScreenSpans(state, rect),
    toScreenSpans(state, focus)
  );
  if (!place) return;

  const origin = getOriginToPlace(state.settings.zoomLevel, rect, place);
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
 * canvas; null for a cell that fits, which shows the range itself.
 */
function getRangeRect(state: RootState, cell: Rect, range?: Span): Rect | null {
  const [cellX] = toScreenSpans(state, cell);
  const clear = state.editor.viewport.width - EDGE_MARGIN * 2;
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
  const found = getRangeRect(state, cell, range);
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
  focusType: FocusType = FocusType.tableName,
  range?: Span
) {
  yield* scrollIntoView(
    state,
    getTableRect(state, table),
    getTableFocusRect(state, table, focusType, range)
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
  return getRangeRect(state, cell, range) ?? cell;
}

/**
 * The cell a target is found in, or the name beside a comment while the
 * comments are hidden, so the focus ring never lands on a cell nobody can see.
 * The name view draws the logical name in the name's place, and back.
 */
function visibleFocusType(state: RootState, focusType: FocusType): FocusType {
  const { settings } = state;
  const { show } = settings;
  let asked = focusType;

  if (focusType === FocusType.tableComment && !bHas(show, Show.tableComment)) {
    asked = FocusType.tableName;
  }
  if (
    focusType === FocusType.columnComment &&
    !bHas(show, Show.columnComment)
  ) {
    asked = FocusType.columnName;
  }

  const types = isTableFocusType(asked)
    ? getTableFocusTypes(settings)
    : getColumnFocusTypes(settings);
  return toShownFocusType(settings, types, asked) ?? asked;
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
 * The relationship with its two tables while the document lists all three,
 * else null. A removed entity stays in its collection and leaves only the id
 * lists, so a relationship or table found there alone is one nobody sees.
 */
function findShownRelationship({ doc, collections }: RootState, id: string) {
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(id);
  if (!relationship || !doc.relationshipIds.includes(id)) return null;

  const tables = query(collections).collection('tableEntities');
  const start = tables.selectById(relationship.start.tableId);
  const end = tables.selectById(relationship.end.tableId);
  if (!start || !doc.tableIds.includes(start.id)) return null;
  if (!end || !doc.tableIds.includes(end.id)) return null;

  return { relationship, start, end };
}

/**
 * Whether a jump to the relationship shows it, as showErdTargetAction$ does
 * only while it and both its tables stand; a host lights none it did not show.
 */
export function isRelationshipShown(
  state: RootState,
  relationshipId: string
): boolean {
  return findShownRelationship(state, relationshipId) !== null;
}

/**
 * Brings a relationship's two tables into view as one box and selects the
 * child table alone with its foreign key columns, the first focused. Where the
 * two are too far apart to show together, the child is the part that shows.
 */
function* showRelationship(state: RootState, relationshipId: string) {
  const shown = findShownRelationship(state, relationshipId);
  if (!shown) return;

  const { relationship, start, end } = shown;
  const endRect = getTableRect(state, end);
  yield* scrollIntoView(
    state,
    unionRect(getTableRect(state, start), endRect),
    endRect
  );
  yield selectTableAloneAction$(end.id);

  // In the child's own order; each after the first joins the selection, and
  // the first is focused again last, so the ring stands on it.
  const columnIds = end.columnIds.filter(id =>
    relationship.end.columnIds.includes(id)
  );
  const focus = (columnId: string, $mod: boolean) =>
    focusColumnAction({
      tableId: end.id,
      columnId,
      focusType: FocusType.columnName,
      $mod,
      shiftKey: false,
    });
  for (const [index, columnId] of columnIds.entries()) {
    yield focus(columnId, index > 0);
  }
  if (columnIds.length > 1) yield focus(columnIds[0], true);
}

/** Brings a table group's box into view by its title bar, and selects it alone. */
function* showTableGroup(state: RootState, tableGroupId: string) {
  // A group found before the groups were hidden goes nowhere, as a memo does.
  if (!isTableGroupShown(state)) return;
  const group = query(state.collections)
    .collection('tableGroupEntities')
    .selectById(tableGroupId);
  if (!group || !state.doc.tableGroupIds.includes(tableGroupId)) return;

  const box = getTableGroupRect(state, group);
  yield* scrollIntoView(state, box, {
    ...box,
    height: Math.min(box.height, TABLE_GROUP_TITLE_HEIGHT),
  });
  yield selectTableGroupAction$(group.id, false);
}

/**
 * Stands the reader on a table, a column cell, a memo, a relationship or a
 * table group by the one jump rule, with the focus ring on the cell asked for.
 * A row too wide goes by the ringed cell, a cell too wide by the range found.
 */
export const showErdTargetAction$ = (target: ErdTarget): GeneratorAction =>
  function* (state, ctx) {
    if (target.kind === 'relationship') {
      yield* showRelationship(state, target.relationshipId);
      return;
    }

    if (target.kind === 'tableGroup') {
      yield* showTableGroup(state, target.tableGroupId);
      return;
    }

    if (target.kind === 'memo') {
      // A row found before the memos were hidden goes nowhere, so neither its
      // selection nor a Delete after it reaches a memo no reader sees.
      if (!isMemoShown(state)) return;
      const memo = query(state.collections)
        .collection('memoEntities')
        .selectById(target.memoId);
      if (!memo) return;

      yield* scrollIntoView(state, getMemoRect(memo));
      yield selectMemoAction$(memo.id, false);
      return;
    }

    const table = query(state.collections)
      .collection('tableEntities')
      .selectById(target.tableId);
    if (!table) return;

    if (target.kind === 'table') {
      const focusType = visibleFocusType(
        state,
        target.focusType ?? FocusType.tableName
      );
      yield* scrollTableIntoView(
        state,
        table,
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
      yield* scrollTableIntoView(state, table);
    } else {
      yield* scrollIntoView(
        state,
        getColumnRect(state, table, index),
        getColumnFocusRect(
          state,
          table,
          index,
          focusType,
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
 * from whichever tab is up, measured on the canvas once the ERD tab is up.
 *
 * @example
 * goToErdTarget(store, { kind: 'memo', memoId: 'note' });
 */
export function goToErdTarget(store: RxStore, target: ErdTarget): void {
  showErdTab(store);
  store.dispatchSync(showErdTargetAction$(target));
}
