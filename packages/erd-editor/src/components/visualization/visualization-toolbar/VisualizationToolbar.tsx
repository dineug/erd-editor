import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  COMPASS_ARROW_SIZE,
  type ContentCompass,
  getContentCompass,
  scrollToNearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import { showAllFlowView } from '@/components/flowCenters';
import Icon from '@/components/primitives/icon/Icon';
import {
  ensureFlowPlaced,
  fitFlowView,
} from '@/components/visualization/flowLayout';
import {
  getGraphView,
  updateGraphView,
} from '@/components/visualization/graphViewHandle';
import {
  centerGraphView,
  fitGraphView,
  graphCompass,
} from '@/components/visualization/visualizationView';
import { stepVisualizationZoom } from '@/components/visualization/zoomVisualization';
import { ZOOM_STEP } from '@/constants/zoom';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeShowModeAction,
} from '@/engine/modules/editor/view.actions';
import { getSceneTransform } from '@/konva/scene/viewport';

import * as styles from './VisualizationToolbar.styles';

export type VisualizationToolbarProps = {};

const ICON_SIZE = 16;

/** The three steps of a card, in the order the bar offers them. */
const SHOW_MODES = [
  { value: ShowMode.nameOnly, title: 'Name only', icon: 'case-sensitive' },
  { value: ShowMode.keysOnly, title: 'Keys only', icon: 'key-round' },
  { value: ShowMode.allFields, title: 'All fields', icon: 'table' },
] as const;

/**
 * The bar over the bottom of the Visualization tab: which of the two modes is
 * up, the zoom, the placement tools of the Flow, how much of a card it draws,
 * the way back to the whole document, and where the content lies once the screen holds none.
 */
const VisualizationToolbar: FC<VisualizationToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const isFlow = () =>
    app.value.store.state.editor.visualizationMode === VisualizationMode.flow;

  const handleMode = (value: VisualizationMode) => () => {
    const { store } = app.value;
    store.dispatch(changeVisualizationModeAction({ value }));
  };

  const handleZoom = (step: number) => () => {
    stepVisualizationZoom(app.value, step);
  };

  const handleFit = () => {
    const { store } = app.value;

    if (isFlow()) {
      fitFlowView(store);
      return;
    }

    const { editor } = store.state;
    updateGraphView(editor.id, ({ nodes }) =>
      fitGraphView(nodes(), editor.viewport)
    );
  };

  const handleTidyUp = () => {
    ensureFlowPlaced(app.value, { force: true });
  };

  const handleShowMode = (value: ShowMode) => () => {
    const { store } = app.value;
    store.dispatch(viewChangeShowModeAction({ value, kind: ViewKind.flow }));
  };

  const handleShowAll = () => {
    showAllFlowView(app.value);
  };

  const handleCompass = () => {
    const { store } = app.value;

    if (isFlow()) {
      scrollToNearestContent(store, ViewKind.flow);
      return;
    }

    const { editor } = store.state;
    updateGraphView(editor.id, ({ state, nodes }) => {
      const compass = graphCompass(state, nodes(), editor.viewport);

      return compass
        ? centerGraphView(state, compass.target, editor.viewport)
        : null;
    });
  };

  return () => {
    const { store } = app.value;
    const { editor } = store.state;
    const flow = editor.visualizationMode === VisualizationMode.flow;
    const view = editor.views.flow;
    const graph = getGraphView(editor.id);
    const zoomLevel = flow
      ? getSceneTransform(store.state, ViewKind.flow).zoomLevel
      : graph.state.scale;
    const showAll = flow && Boolean(view?.centerIds.length);
    const compass: ContentCompass | null = flow
      ? getContentCompass(store.state, ViewKind.flow)
      : graphCompass(graph.state, graph.nodes(), editor.viewport);

    return (
      <div class={['visualization-toolbar', styles.root]}>
        <div
          class={[floating.menu, { active: !flow }]}
          title="Graph"
          on:click={handleMode(VisualizationMode.graph)}
        >
          <Icon name="atom" size={ICON_SIZE} />
        </div>
        <div
          class={[floating.menu, { active: flow }]}
          title="Flow"
          on:click={handleMode(VisualizationMode.flow)}
        >
          <Icon name="waypoints" size={ICON_SIZE} />
        </div>
        <div class={styles.divider}></div>
        <div
          class={floating.menu}
          title="Zoom out"
          on:click={handleZoom(-ZOOM_STEP)}
        >
          <Icon name="minus" size={ICON_SIZE} />
        </div>
        <span class={styles.readout}>{`${Math.round(zoomLevel * 100)}%`}</span>
        <div
          class={floating.menu}
          title="Zoom in"
          on:click={handleZoom(ZOOM_STEP)}
        >
          <Icon name="plus" size={ICON_SIZE} />
        </div>
        <div class={styles.divider}></div>
        <div class={floating.menu} title="Fit" on:click={handleFit}>
          <Icon name="fullscreen" size={ICON_SIZE} />
        </div>
        {flow ? (
          <div class={floating.menu} title="Tidy Up" on:click={handleTidyUp}>
            <Icon name="wand-sparkles" size={ICON_SIZE} />
          </div>
        ) : null}
        {flow ? (
          <>
            <div class={styles.divider}></div>
            {SHOW_MODES.map(mode => (
              <div
                class={[
                  floating.menu,
                  { active: view?.showMode === mode.value },
                ]}
                title={mode.title}
                on:click={handleShowMode(mode.value)}
              >
                <Icon name={mode.icon} size={ICON_SIZE} />
              </div>
            ))}
          </>
        ) : null}
        {showAll ? (
          <>
            <div class={styles.divider}></div>
            <div
              class={floating.menu}
              title="Show all"
              on:click={handleShowAll}
            >
              <Icon name="maximize" size={ICON_SIZE} />
            </div>
          </>
        ) : null}
        {compass ? (
          <>
            <div class={styles.divider}></div>
            <div
              class={floating.menu}
              title="Go to content"
              on:click={handleCompass}
            >
              <Icon
                name="arrow-right"
                size={COMPASS_ARROW_SIZE}
                rotate={compass.angle}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  };
};

export default VisualizationToolbar;
