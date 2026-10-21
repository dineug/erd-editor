import { observable, onMounted, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { FocusType, type SharedFocus } from '@/engine/modules/editor/state';
import {
  getColumnFocusTypes,
  getTableFocusTypes,
  getViewColumnFocusTypes,
  sceneNameSettings,
  toShownFocusType,
} from '@/engine/modules/editor/utils/nameView';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Ctx } from '@/internal-types';
import { isFocus } from '@/utils/focus';
import { toSharedColor } from '@/utils/sharedColor';

export function useSharedFocusTable(ctx: Ctx, tableId: string) {
  const app = useAppContext(ctx);
  const sourceRef = useSceneSource(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({ force: false });

  const forceUpdate = () => {
    state.force = !state.force;
  };

  onMounted(() => {
    const { store } = app.value;
    const {
      editor: { sharedFocusTrackerMap },
    } = store.state;

    addUnsubscribe(watch(sharedFocusTrackerMap).subscribe(forceUpdate));
  });

  const getTrackers = () => {
    const { store } = app.value;

    // observable dependency
    state.force;

    return Object.values(store.state.editor.sharedFocusTrackerMap);
  };

  const sharedFocusTableColor = () => {
    const tracker = getTrackers().find(tracker => tracker.tableId === tableId);
    return tracker ? toSharedColor(tracker.id) : null;
  };

  /**
   * The cell a peer's focus lands on here: the one this reader draws in the
   * place of the peer's, as its own focus lands, since a locked name view is
   * each reader's own; a view lays its cells out under no show bit.
   */
  const toShownFocus = (tracker: SharedFocus): SharedFocus => {
    const { settings } = app.value.store.state;
    const source = sourceRef.value;
    const shown = sceneNameSettings(settings, source);
    const types =
      tracker.columnId === null
        ? getTableFocusTypes(shown)
        : source === 'document'
          ? getColumnFocusTypes(settings)
          : getViewColumnFocusTypes(settings);
    const focusType = toShownFocusType(shown, types, tracker.focusType);

    return focusType ? { ...tracker, focusType } : tracker;
  };

  const sharedFocusColor = (focusType: FocusType, columnId?: string) => {
    const tracker = getTrackers().find(tracker =>
      isFocus(toShownFocus(tracker), focusType, tableId, columnId)
    );
    return tracker ? toSharedColor(tracker.id) : null;
  };

  return {
    sharedFocusTableColor,
    sharedFocusColor,
  };
}
