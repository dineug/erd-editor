import { FC, observable, onMounted, repeat, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import * as styles from '@/components/erd/drag-select/DragSelect.styles';
import { useUnmounted } from '@/hooks/useUnmounted';
import { toSharedColor } from '@/utils/sharedColor';

export type SharedDragSelectProps = {};

const SharedDragSelect: FC<SharedDragSelectProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({ force: false });

  const forceUpdate = () => {
    state.force = !state.force;
  };

  onMounted(() => {
    const { store } = app.value;
    const {
      editor: { sharedDragSelectTrackerMap },
    } = store.state;

    addUnsubscribe(watch(sharedDragSelectTrackerMap).subscribe(forceUpdate));
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { sharedDragSelectTrackerMap },
    } = store.state;

    // observable dependency
    state.force;

    return (
      <>
        {repeat(
          Object.values(sharedDragSelectTrackerMap),
          tracker => tracker.id,
          tracker => {
            const color = toSharedColor(tracker.id);

            return (
              <svg
                class={styles.dragSelect}
                data-testid="shared-drag-select"
                style={{
                  left: `${tracker.x}px`,
                  top: `${tracker.y}px`,
                  width: `${tracker.w}px`,
                  height: `${tracker.h}px`,
                  stroke: color,
                  fill: color,
                }}
              >
                <rect
                  width={tracker.w}
                  height={tracker.h}
                  stroke-width="1"
                  stroke-opacity="1"
                  stroke-dasharray="3"
                  fill-opacity="0.08"
                ></rect>
              </svg>
            );
          }
        )}
      </>
    );
  };
};

export default SharedDragSelect;
