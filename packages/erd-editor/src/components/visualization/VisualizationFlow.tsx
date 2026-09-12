import {
  createRef,
  FC,
  onMounted,
  type Ref,
  ref,
  useProvider,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import ContentCompass from '@/components/erd/content-compass/ContentCompass';
import * as styles from '@/components/erd/Erd.styles';
import { sceneHit } from '@/components/erd/hitTest';
import Minimap from '@/components/erd/minimap/Minimap';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import {
  hasFlowLayout,
  isFlowLayoutPending,
  placeFlowView,
  restoreFlowLayout,
} from '@/components/visualization/flowLayout';
import { wheelZoomFactor } from '@/components/visualization/visualizationView';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeZoomLevelAction,
  viewScrollToAction,
} from '@/engine/modules/editor/view.actions';
import { sceneStreamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import {
  getOriginToPlace,
  getSceneTransform,
  toScenePoint,
} from '@/konva/scene/viewport';
import {
  editorRootOf,
  isMouseEvent,
  suppressSelection,
} from '@/utils/domEvent';
import { dragSelectStartAction } from '@/utils/emitter';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';
import { zoomLevelInRange } from '@/utils/validation';

/** The Flow scene reads the flow slot, whichever view is active over it. */
const SOURCE = ViewKind.flow;

type FlowSceneProps = {
  root: Ref<HTMLDivElement>;
  canvas: Ref<HTMLDivElement>;
};

/**
 * The scene and its aids under one provider. A component provides on its
 * parent element, so this sits inside the box the mode draws and the source
 * reaches the canvas, the map, the scrollbars and the compass, and nothing beside them.
 */
const FlowScene: FC<FlowSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const sceneSource = useProvider(ctx, sceneSourceContext, SOURCE);
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => sceneSource.destroy());

  return () => {
    const { store } = app.value;
    // A Flow that has placed nothing has no travel and draws no map, exactly
    // as an empty document draws none.
    const hasContent = getSceneContentRect(store.state, SOURCE) !== null;

    return (
      <>
        <Canvas root={props.root} canvas={props.canvas} />
        <VirtualScroll />
        {hasContent ? <Minimap /> : null}
        <ContentCompass />
      </>
    );
  };
};

export type VisualizationFlowProps = {};

/**
 * The Flow mode of the tab: every table as a name box, placed once by ELK and
 * kept for the session, drawn by the same scene the ERD is. The wheel zooms
 * about the pointer and a drag on the background pans, as the graph beside it reads them.
 */
const VisualizationFlow: FC<VisualizationFlowProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const { store } = app.value;
    if (!store.state.editor.views.flow) return;

    const rect = root.value.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const transform = getSceneTransform(store.state, SOURCE);
    const anchor = toScenePoint(transform, point);
    const value = zoomLevelInRange(
      transform.zoomLevel * wheelZoomFactor(event.deltaY, event.deltaMode)
    );
    const origin = getOriginToPlace(value, anchor, point);

    store.dispatch(
      viewChangeZoomLevelAction({ value, kind: SOURCE }),
      viewScrollToAction({ originX: origin.x, originY: origin.y, kind: SOURCE })
    );
  };

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    if (movementX === 0 && movementY === 0) return;

    const { store } = app.value;
    store.dispatch(sceneStreamScrollToAction(SOURCE, { movementX, movementY }));
  };

  /**
   * A press on the background pans, or with the modifier opens the marquee of
   * this scene; a press on a table is that table's own drag. The aids over the
   * scene take their own presses, so none of them starts a pan.
   */
  const handleMousedown = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const onAid = Boolean(
      el.closest('.minimap') ||
      el.closest('.minimap-viewport') ||
      el.closest('.virtual-scroll') ||
      el.closest('.content-compass')
    );
    if (onAid) return;

    const hit = sceneHit(canvas.value, event);
    if (hit?.kind === 'table') return;

    const { store, emitter } = app.value;
    store.dispatch(unselectAllAction$());

    if (isMouseEvent(event) && isMod(event)) {
      event.preventDefault();
      const { x, y } = root.value.getBoundingClientRect();
      emitter.emit(
        dragSelectStartAction({
          x: event.clientX - x,
          y: event.clientY - y,
          source: SOURCE,
        })
      );
      return;
    }

    // Before the first move: the selection a press starts is already there by
    // the time a mousemove could preventDefault it, and the native drag it
    // turns into is what eats the mouseup this ends on.
    const restoreSelection = suppressSelection(editorRootOf(root.value));

    drag$.subscribe({ next: handleMove }).add(restoreSelection);
  };

  onMounted(() => {
    const { store } = app.value;

    // Placed once for the session: a return to the tab stands the view back on
    // that landing, dropping what a drag moved, or waits on the ask still out
    // for it, and asks ELK nothing either way.
    if (hasFlowLayout(store.state)) {
      restoreFlowLayout(store);
    } else if (!isFlowLayoutPending(store.state)) {
      placeFlowView(app.value);
    }
  });

  // The box the ERD tab hangs its scene in, which the scrollbars, the map and
  // the compass are placed against and the scene source is provided on.
  return () => (
    <div
      class={styles.root}
      use:ref={ref(root)}
      on:mousedown={handleMousedown}
      on:touchstart={handleMousedown}
      on:wheel={handleWheel}
    >
      <FlowScene root={root} canvas={canvas} />
    </div>
  );
};

export default VisualizationFlow;
