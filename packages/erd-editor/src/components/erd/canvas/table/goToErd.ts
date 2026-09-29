import { query } from '@dineug/erd-editor-schema';

import { scrollIntoView } from '@/components/erd/goToErdTarget';
import { CanvasType } from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import type { RxStore } from '@/engine/rx-store';
import { getTableRect } from '@/konva/scene/metrics';

/**
 * Stands the reader on one table in the document, selected, scrolled to the
 * middle of the screen at the document's own zoom unless it is already on
 * screen whole, since that scroll is the one change the host hears of. One that is gone is passed over.
 */
export const showErdTableAction$ = (tableId: string): GeneratorAction =>
  function* (state) {
    const table = query(state.collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return;

    yield* scrollIntoView(state, getTableRect(state, table));
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
