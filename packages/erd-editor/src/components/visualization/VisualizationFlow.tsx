import {
  createRef,
  FC,
  onMounted,
  type Ref,
  ref,
  useProvider,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Canvas, { type CanvasLayers } from '@/components/erd/canvas/Canvas';
import DragSelect from '@/components/erd/canvas/drag-select/DragSelect';
import * as styles from '@/components/erd/Erd.styles';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import {
  ensureFlowPlaced,
  keepFlowPlaced,
} from '@/components/visualization/flowLayout';
import ParticleLayer from '@/components/visualization/particles/ParticleLayer';
import { useViewGestures } from '@/components/visualization/useViewGestures';
import { ViewKind } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';

/** The Flow scene reads the flow slot, whichever view is active over it. */
const SOURCE = ViewKind.flow;

/**
 * What the Flow adds to the scene: the particles of its lit connectors, under
 * the cards that hide those connectors, and the marquee a modifier press opens.
 */
const FLOW_LAYERS: CanvasLayers = {
  beneath: ParticleLayer,
  marquee: DragSelect,
};

type FlowSceneProps = {
  root: Ref<HTMLDivElement>;
  canvas: Ref<HTMLDivElement>;
};

/**
 * The scene under its own provider. A component provides on its parent
 * element, so this sits inside the box the mode draws and the source reaches
 * the canvas and nothing beside it. The tab's bar carries what the ERD hangs over its scene.
 */
const FlowScene: FC<FlowSceneProps> = (props, ctx) => {
  const sceneSource = useProvider(ctx, sceneSourceContext, SOURCE);
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => sceneSource.destroy());

  return () => (
    <Canvas root={props.root} canvas={props.canvas} layers={FLOW_LAYERS} />
  );
};

export type VisualizationFlowProps = {};

/**
 * The Flow mode of the tab: the tables of a display set, placed once by ELK
 * and kept for the session, drawn by the same scene the ERD is. The wheel
 * moves the screen and a drag on the background pans, as the ERD tab reads them.
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

  // The box the ERD tab hangs its scene in, which the gestures are measured
  // against and the scene source is provided on.
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
