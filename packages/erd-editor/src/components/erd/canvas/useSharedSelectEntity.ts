import { observable, onMounted, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Ctx } from '@/internal-types';
import { toSharedColor } from '@/utils/sharedColor';

export function useSharedSelectEntity(ctx: Ctx, entityId: string) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({ force: false });

  const forceUpdate = () => {
    state.force = !state.force;
  };

  onMounted(() => {
    const { store } = app.value;
    const {
      editor: { sharedSelectionTrackerMap },
    } = store.state;

    addUnsubscribe(watch(sharedSelectionTrackerMap).subscribe(forceUpdate));
  });

  const sharedSelectColor = () => {
    const { store } = app.value;

    // observable dependency
    state.force;

    const tracker = Object.values(
      store.state.editor.sharedSelectionTrackerMap
    ).find(tracker => tracker.selectedIds.includes(entityId));

    return tracker ? toSharedColor(tracker.id) : null;
  };

  return {
    sharedSelectColor,
  };
}
