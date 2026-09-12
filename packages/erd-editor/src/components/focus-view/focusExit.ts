import { query } from '@dineug/erd-editor-schema';

import { GeneratorAction } from '@/engine/generator.actions';
import { closeFocusViewAction$ } from '@/engine/modules/editor/view.generator.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import { unionRect } from '@/konva/scene/contentBounds';
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
 * Stands the reader on the tables given in the document, all selected, the
 * box round them scrolled to the middle of the screen at the document's zoom
 * unless it is on screen whole, since that scroll is a change the host hears of. One that is gone is passed over.
 */
export const returnToCentersAction$ = (centerIds: string[]): GeneratorAction =>
  function* (state) {
    const { viewport } = state.editor;
    const tables = query(state.collections)
      .collection('tableEntities')
      .selectByIds(centerIds);
    if (!tables.length) return;

    const rect = tables
      .map(table => getTableRect(state, table))
      .reduce(unionRect);
    if (!isOnScreen(state, rect)) {
      const origin = getOriginToPlace(
        state.settings.zoomLevel,
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        { x: viewport.width / 2, y: viewport.height / 2 }
      );
      yield scrollToAction({ originX: origin.x, originY: origin.y });
    }

    for (const [index, { id }] of tables.entries()) {
      yield selectTableAction$(id, index > 0);
    }
  };

/**
 * The way out of a Focus view: the close and the tab in one dispatch, the
 * scroll to its last centers and their selection in a second. A batch is
 * classified by the state before it, so a scroll in the first would land in the view it closes.
 *
 * @example
 * shortcut$.subscribe(({ type }) => type === KeyBindingName.stop && leaveFocusView(store));
 */
export function leaveFocusView(store: RxStore): void {
  const view = store.state.editor.views.focus;
  if (!view) return;

  const centerIds = [...view.centerIds];
  store.dispatchSync(closeFocusViewAction$());
  store.dispatchSync(returnToCentersAction$(centerIds));
}
