import { query } from '@dineug/erd-editor-schema';

import { CanvasType } from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  changeCanvasTypeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import { getTableRect, type Rect } from '@/konva/scene/metrics';
import { getOriginToPlace, toScreenPoint } from '@/konva/scene/viewport';

/** Whether the document rect given is on screen whole, at the document's own placement. */
function isOnScreen(state: RootState, rect: Rect): boolean {
  const { settings } = state;
  const { viewport } = state.editor;
  const topLeft = toScreenPoint(settings, rect);
  const bottomRight = toScreenPoint(settings, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });

  return (
    topLeft.x >= 0 &&
    topLeft.y >= 0 &&
    bottomRight.x <= viewport.width &&
    bottomRight.y <= viewport.height
  );
}

/**
 * Stands the reader on one table in the document, selected, scrolled to the
 * middle of the screen at the document's own zoom unless it is already on
 * screen whole, since that scroll is the one change the host hears of. One that is gone is passed over.
 */
export const showErdTableAction$ = (tableId: string): GeneratorAction =>
  function* (state) {
    const { viewport } = state.editor;
    const table = query(state.collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return;

    const rect = getTableRect(state, table);
    if (!isOnScreen(state, rect)) {
      const origin = getOriginToPlace(
        state.settings.zoomLevel,
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        { x: viewport.width / 2, y: viewport.height / 2 }
      );
      yield scrollToAction({ originX: origin.x, originY: origin.y });
    }

    yield selectTableAction$(tableId, false);
  };

/**
 * The Go to ERD button's whole errand: the tab in one dispatch, the scroll and
 * the selection in a second. A batch is classified by the state before it, so
 * a scroll travelling with the tab change would be redirected into the view it leaves.
 *
 * @example
 * goToErdTable(store, 'orders');
 */
export function goToErdTable(store: RxStore, tableId: string): void {
  store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
  store.dispatchSync(showErdTableAction$(tableId));
}
