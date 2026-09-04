/** @jsxHost konva */

import { FC, observable, onMounted, repeat, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import SharedMouseCursor from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor';
import { useUnmounted } from '@/hooks/useUnmounted';

export type SharedMouseTrackerProps = {};

/** One cursor per peer sharing a pointer, on the presence layer. */
const SharedMouseTracker: FC<SharedMouseTrackerProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({ force: false });

  const forceUpdate = () => {
    state.force = !state.force;
  };

  onMounted(() => {
    const { store } = app.value;
    const {
      editor: { sharedMouseTrackerMap },
    } = store.state;

    addUnsubscribe(watch(sharedMouseTrackerMap).subscribe(forceUpdate));
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { sharedMouseTrackerMap },
    } = store.state;

    // observable dependency
    state.force;

    return (
      <>
        {repeat(
          Object.values(sharedMouseTrackerMap),
          tracker => tracker.id,
          tracker => (
            <SharedMouseCursor tracker={tracker} />
          )
        )}
      </>
    );
  };
};

export default SharedMouseTracker;
