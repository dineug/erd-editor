import { query } from '@dineug/erd-editor-schema';

import { coveredWidth } from '@/components/find-replace/panelLayout';
import { CanvasType, Show } from '@/constants/schema';
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
  type Rect,
} from '@/konva/scene/metrics';
import { getOriginToPlace, toScreenPoint } from '@/konva/scene/viewport';
import { nextZIndex } from '@/utils';
import { bHas } from '@/utils/bit';
import { isHighLevelTable } from '@/utils/validation';

/** What a jump to the ERD lands on: a table, one cell of a column, or a memo. */
export type ErdTarget =
  | { kind: 'table'; tableId: string; focusType?: FocusType }
  | {
      kind: 'column';
      tableId: string;
      columnId: string;
      focusType: FocusType;
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
 * Brings a table on screen whole, or one too big for the screen by where it
 * shows its name, which a jump or a selection rings, rather than by a middle.
 */
export function* scrollTableIntoView(
  state: RootState,
  table: Table,
  covered = 0
) {
  yield* scrollIntoView(
    state,
    getTableRect(state, table),
    covered,
    getTableNameRect(state, table)
  );
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
 * Stands the reader on a table, a column cell or a memo the way the Go to ERD
 * button stands them on a table, with the focus ring on the cell asked for. A
 * column is scrolled to by its own row, which a tall table may hold off screen.
 *
 * @param covered How far in from the left edge a panel over the canvas hides it.
 */
export const showErdTargetAction$ = (
  target: ErdTarget,
  covered = 0
): GeneratorAction =>
  function* (state) {
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
      yield* scrollTableIntoView(state, table, covered);
      yield selectTableAloneAction$(table.id);
      if (target.focusType) {
        yield focusTableAction({
          tableId: table.id,
          focusType: visibleFocusType(state, target.focusType),
        });
      }
      return;
    }

    const index = table.columnIds.indexOf(target.columnId);
    if (index === -1) return;

    // Zoomed out far enough, a table is drawn as its name alone.
    if (isHighLevelTable(state.settings.zoomLevel)) {
      yield* scrollTableIntoView(state, table, covered);
    } else {
      yield* scrollIntoView(state, getColumnRect(state, table, index), covered);
    }
    yield selectTableAloneAction$(table.id);
    yield focusColumnAction({
      tableId: table.id,
      columnId: target.columnId,
      focusType: visibleFocusType(state, target.focusType),
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
