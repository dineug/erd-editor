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
import Minimap from '@/components/erd/minimap/Minimap';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import {
  ensureFlowPlaced,
  keepFlowPlaced,
} from '@/components/visualization/flowLayout';
import { useViewGestures } from '@/components/visualization/useViewGestures';
import { ViewKind } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getSceneContentRect } from '@/konva/scene/contentBounds';

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

  const { addUnsubscribe } = useUnmounted();

  const { handleWheel, handleMousedown } = useViewGestures(ctx, {
    root,
    canvas,
    source: SOURCE,
  });

  // Placed on the one question this mount and the loop both ask: a return to
  // the tab stands the view back on the landing its display set has, dropping
  // what a drag moved, or joins the ask still out for it.
  onMounted(() => {
    ensureFlowPlaced(app.value);
    addUnsubscribe(keepFlowPlaced(app.value));
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
