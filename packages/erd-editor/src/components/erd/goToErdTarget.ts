import { query } from '@dineug/erd-editor-schema';

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
import {
  getColumnRect,
  getMemoRect,
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

/**
 * Whether the document rect given is on screen whole, at the document's own
 * placement, right of the strip a panel floating over the left edge covers.
 */
function isOnScreen(state: RootState, rect: Rect, covered: number): boolean {
  const { settings } = state;
  const { viewport } = state.editor;
  const topLeft = toScreenPoint(settings, rect);
  const bottomRight = toScreenPoint(settings, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });

  return (
    topLeft.x >= covered &&
    topLeft.y >= 0 &&
    bottomRight.x <= viewport.width &&
    bottomRight.y <= viewport.height
  );
}

/**
 * The scroll that puts the rect in the middle of what the screen shows at the
 * document's own zoom, unless it is shown whole already, since that scroll is
 * the one change of a jump the host hears of.
 */
export function* scrollIntoView(state: RootState, rect: Rect, covered = 0) {
  if (isOnScreen(state, rect, covered)) return;

  const { viewport } = state.editor;
  const origin = getOriginToPlace(
    state.settings.zoomLevel,
    { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    { x: covered + (viewport.width - covered) / 2, y: viewport.height / 2 }
  );
  yield scrollToAction({ originX: origin.x, originY: origin.y });
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
function* selectTable({ doc, collections }: RootState, tableId: string) {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds);

  yield unselectAllAction();
  yield selectAction({ [tableId]: SelectType.table });
  yield changeZIndexAction({ id: tableId, zIndex: nextZIndex(tables, memos) });
  yield focusTableAction({ tableId });
}

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
      yield* scrollIntoView(state, getTableRect(state, table), covered);
      yield* selectTable(state, table.id);
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
    const rect = isHighLevelTable(state.settings.zoomLevel)
      ? getTableRect(state, table)
      : getColumnRect(state, table, index);
    yield* scrollIntoView(state, rect, covered);
    yield* selectTable(state, table.id);
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
 * from whichever tab is up.
 *
 * @example
 * goToErdTarget(store, { kind: 'memo', memoId: 'note' });
 */
export function goToErdTarget(
  store: RxStore,
  target: ErdTarget,
  covered = 0
): void {
  showErdTab(store);
  store.dispatchSync(showErdTargetAction$(target, covered));
}
