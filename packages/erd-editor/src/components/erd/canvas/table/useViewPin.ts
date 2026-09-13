import type { Ref } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import type { Table } from '@/internal-types';
import { setViewPinnedTable } from '@/konva/scene/viewLayout';
import { isPlainPress, onClickRelease } from '@/utils/clickGesture';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/**
 * The click a view scene takes on a table: pressed with the main button and
 * lifted without moving and without the modifier. It pins the highlight on
 * that table, and a second click on the same one lets it go. Documents take none.
 *
 * @example
 * const pin = useViewPin(app, props, sourceRef);
 */
export function useViewPin(
  app: Ref<AppContext>,
  props: { table: Table },
  source: Ref<GeometrySource>
) {
  const onPress = (event: ScenePointerEvent) => {
    const { evt } = event;
    const kind = source.value;
    if (kind === 'document' || !isPlainPress(evt)) return;

    // The view that took the press, which a reopen does not revive: the press
    // selects the table and the scene rebuilds its node before the lift, so
    // the release the gesture answers for is read off the window.
    const view = app.value.store.state.editor.views[kind];
    if (!view) return;

    const { id } = props.table;
    onClickRelease(evt, () => {
      const { store } = app.value;
      if (store.state.editor.views[kind] !== view) return;

      setViewPinnedTable(store.state, id, kind);
    });
  };

  return { onPress };
}
