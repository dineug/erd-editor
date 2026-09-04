/** @jsxHost konva */

import { FC, observable, onMounted, Ref } from '@dineug/r-html';
import { fromEvent, Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { useThemeContext } from '@/components/themeContext';
import { dragSelectRectAction } from '@/engine/modules/editor/atom.actions';
import { dragSelectAction$ } from '@/engine/modules/editor/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getAbsolutePoint } from '@/utils/dragSelect';
import { mouseup$ } from '@/utils/globalEventObservable';

const STROKE_WIDTH = 1;
const BACKGROUND_OPACITY = 0.3;

/** Three on and three off, which is what the SVG spelled as one dash number. */
const DASH = [3, 3];

export type DragSelectProps = {
  root: Ref<HTMLDivElement>;
};

/**
 * The marquee, drawn in the screen space its own mousemove measures against the
 * erd root. Its home is the overlay layer the canvas leaves untransformed, so
 * these are the numbers the DOM version wrote into left and top.
 */
const DragSelect: FC<DragSelectProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const state = observable({
    active: false,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  });
  const { addUnsubscribe } = useUnmounted();

  let subscription: Subscription | null = null;

  const stop = () => {
    const { store } = app.value;
    subscription?.unsubscribe();
    subscription = null;
    state.active = false;
    state.width = 0;
    state.height = 0;
    store.dispatchSync(dragSelectRectAction({ rect: null }));
  };

  const start = (startX: number, startY: number) => {
    const { store } = app.value;
    const $root = props.root.value;
    if (!$root) return;

    subscription?.unsubscribe();
    state.active = true;
    state.left = startX;
    state.top = startY;
    state.width = 0;
    state.height = 0;

    subscription = new Subscription();
    subscription.add(mouseup$.subscribe(stop));
    subscription.add(
      fromEvent<MouseEvent>($root, 'mousemove').subscribe(event => {
        event.preventDefault();
        const {
          settings: { width, height, zoomLevel, scrollLeft, scrollTop },
        } = store.state;
        const rect = $root.getBoundingClientRect();
        const currentX = event.clientX - rect.x;
        const currentY = event.clientY - rect.y;
        const minX = Math.min(startX, currentX);
        const minY = Math.min(startY, currentY);
        const maxX = Math.max(startX, currentX);
        const maxY = Math.max(startY, currentY);

        state.left = minX;
        state.top = minY;
        state.width = maxX - minX;
        state.height = maxY - minY;

        const absoluteMin = getAbsolutePoint(
          { x: minX - scrollLeft, y: minY - scrollTop },
          width,
          height,
          zoomLevel
        );
        const absoluteMax = getAbsolutePoint(
          { x: maxX - scrollLeft, y: maxY - scrollTop },
          width,
          height,
          zoomLevel
        );

        const dragRect = {
          ...absoluteMin,
          w: absoluteMax.x - absoluteMin.x,
          h: absoluteMax.y - absoluteMin.y,
        };

        store.dispatch(
          dragSelectAction$(dragRect),
          dragSelectRectAction({ rect: dragRect })
        );
      })
    );
  };

  onMounted(() => {
    const { emitter, store } = app.value;

    addUnsubscribe(
      emitter.on({
        dragSelectStart: ({ payload: { x, y } }) => start(x, y),
      }),
      () => {
        subscription?.unsubscribe();
        subscription = null;
        store.dispatchSync(dragSelectRectAction({ rect: null }));
      }
    );
  });

  // Fill and stroke are separate nodes because a konva shape has one opacity
  // for both, and the marquee wants a translucent body under a solid outline.
  return () => {
    if (!state.active) return null;

    return (
      <k-group
        id="drag-select"
        name="drag-select"
        kind="drag-select"
        x={state.left}
        y={state.top}
        listening={false}
      >
        <k-rect
          name="drag-select-background"
          kind="drag-select-background"
          width={state.width}
          height={state.height}
          fill={themeRef.value.dragSelectBackground}
          opacity={BACKGROUND_OPACITY}
        />
        <k-rect
          name="drag-select-border"
          kind="drag-select-border"
          width={state.width}
          height={state.height}
          stroke={themeRef.value.dragSelectBorder}
          strokeWidth={STROKE_WIDTH}
          dash={DASH}
        />
      </k-group>
    );
  };
};

export default DragSelect;
