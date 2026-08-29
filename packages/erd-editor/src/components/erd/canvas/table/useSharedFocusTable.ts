import { observable, onMounted, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { FocusType } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Ctx } from '@/internal-types';
import { isFocus } from '@/utils/focus';
import { toSharedColor } from '@/utils/sharedColor';

export function useSharedFocusTable(ctx: Ctx, tableId: string) {
  const app = useAppContext(ctx);
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

  const sharedFocusColor = (focusType: FocusType, columnId?: string) => {
    const tracker = getTrackers().find(tracker =>
      isFocus(tracker, focusType, tableId, columnId)
    );
    return tracker ? toSharedColor(tracker.id) : null;
  };

  return {
    sharedFocusTableColor,
    sharedFocusColor,
  };
}
