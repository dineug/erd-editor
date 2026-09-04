import { query } from '@dineug/erd-editor-schema';
import {
  createRef,
  FC,
  observable,
  onMounted,
  ref,
  watch,
} from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import Table from '@/components/visualization/table/Table';
import { useUnmounted } from '@/hooks/useUnmounted';
import { renderKonva } from '@/konva/host';
import { registerStage, unregisterStage } from '@/konva/testHandle';

import { createVisualization, type Visualization } from './createVisualization';
import * as styles from './Visualization.styles';
import { renderVisualizationScene } from './VisualizationScene';
import {
  createView,
  createVisualizationState,
  wheelZoomFactor,
  zoomAt,
} from './visualizationView';

/** The registry key a spec reads the graph's Stage back from. */
const STAGE_NAME = 'visualization';

/** How far right of the pointer the table preview opens. */
const MARGIN = 20;

export type VisualizationProps = {};

/**
 * The dom shell around the graph: the Stage container, the wheel that zooms
 * it, and the table preview that opens over a hovered dot. The layout, the
 * view and the hover live in one observable here and never reach the store.
 */
const Visualization: FC<VisualizationProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const canvas = createRef<HTMLDivElement>();
  // The view is centred once the viewport is known, which is on mount; until
  // then nothing reads it, because the scene is not rendered before that.
  const state = observable(createVisualizationState(0, 0), { shallow: true });
  let graph: Visualization | null = null;
  let stage: Stage | null = null;

  /**
   * Zooms about the pointer. There is no scroll here for a plain wheel to
   * spend itself on, so the wheel is the zoom and a drag on the background is
   * the pan, which is how the graph view it follows reads a wheel too.
   */
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const rect = canvas.value.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const factor = wheelZoomFactor(event.deltaY, event.deltaMode);

    Object.assign(state, zoomAt(state, point, factor));
  };

  onMounted(() => {
    const { store } = app.value;
    const { viewport } = store.state.editor;
    const $graph = createVisualization(store.state);
    const $stage = new Stage({
      container: canvas.value,
      width: viewport.width,
      height: viewport.height,
    });

    graph = $graph;
    stage = $stage;
    Object.assign(state, createView(viewport.width, viewport.height));
    $graph.simulation.on('tick', () => {
      state.tick += 1;
    });
    registerStage(STAGE_NAME, $stage);
    renderVisualizationScene($stage, { graph: $graph, state });

    addUnsubscribe(
      watch(viewport).subscribe(() => {
        $stage.size({ width: viewport.width, height: viewport.height });
      }),
      () => {
        graph = null;
        stage = null;
        $graph.simulation.stop();
        unregisterStage(STAGE_NAME, $stage);
        renderKonva($stage, null);
        $stage.destroy();
      }
    );
  });

  if (import.meta.hot) {
    // The scene is the root of an imperative render rather than a value in this
    // template, so r-html's own boundary cannot swap it. Rendering the root
    // again here is what makes an edit to the scene show without a reload.
    import.meta.hot.accept(
      '@/components/visualization/VisualizationScene',
      (mod: any) => {
        if (!stage || !graph || !mod) return;
        mod.renderVisualizationScene(stage, { graph, state });
      }
    );
  }

  return () => {
    const { store } = app.value;
    const { collections } = store.state;
    const { viewport } = store.state.editor;
    const table = state.previewTableId
      ? query(collections)
          .collection('tableEntities')
          .selectById(state.previewTableId)
      : null;
    const showPreview = table && !state.drag;

    return (
      <div class={styles.root} on:wheel={handleWheel}>
        <div
          class={styles.stage}
          data-testid="visualization-canvas"
          use:ref={ref(canvas)}
          style={{
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
          }}
        ></div>
        {showPreview ? (
          <Table
            table={table}
            columnId={state.previewColumnId}
            x={state.previewX + MARGIN}
            y={state.previewY}
          />
        ) : null}
      </div>
    );
  };
};

export default Visualization;
