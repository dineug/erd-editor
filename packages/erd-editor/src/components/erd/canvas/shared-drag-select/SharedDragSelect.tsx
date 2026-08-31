/** @jsxHost konva */

import { FC, observable, onMounted, repeat, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useUnmounted } from '@/hooks/useUnmounted';
import { toSharedColor } from '@/utils/sharedColor';

const STROKE_WIDTH = 1;
const BACKGROUND_OPACITY = 0.08;

/** Three on and three off, which is what the SVG spelled as one dash number. */
const DASH = [3, 3];

export type SharedDragSelectProps = {};

/**
 * A peer's marquee, in the schema coordinates their editor shared. Fainter than
 * the local one because several may be open at once over the same tables.
 */
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
              <k-group
                id={`shared-drag-select-${tracker.id}`}
                name="shared-drag-select"
                kind="shared-drag-select"
                x={tracker.x}
                y={tracker.y}
                listening={false}
              >
                <k-rect
                  name="shared-drag-select-background"
                  kind="shared-drag-select-background"
                  width={tracker.w}
                  height={tracker.h}
                  fill={color}
                  opacity={BACKGROUND_OPACITY}
                />
                <k-rect
                  name="shared-drag-select-border"
                  kind="shared-drag-select-border"
                  width={tracker.w}
                  height={tracker.h}
                  stroke={color}
                  strokeWidth={STROKE_WIDTH}
                  dash={DASH}
                />
              </k-group>
            );
          }
        )}
      </>
    );
  };
};

export default SharedDragSelect;
