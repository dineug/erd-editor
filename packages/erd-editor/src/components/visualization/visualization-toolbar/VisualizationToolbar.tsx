import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  type ContentCompass,
  getContentCompass,
} from '@/components/erd/content-compass/compassGeometry';
import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import Icon from '@/components/primitives/icon/Icon';
import { showAllFlowView } from '@/components/visualization/flowCenters';
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
  zoomAt,
} from '@/components/visualization/visualizationView';
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
import { sceneScrollToAction } from '@/engine/modules/settings/atom.actions';
import { streamZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { getSceneTransform } from '@/konva/scene/viewport';

import * as styles from './VisualizationToolbar.styles';

export type VisualizationToolbarProps = {};

const ICON_SIZE = 16;

/** Small enough beside the buttons to read as the mark a compass pill carries. */
const ARROW_SIZE = 14;

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

  /**
   * One chord's worth of zoom, in the mode that is up. The Flow's runs through
   * the canon the document's own does; the graph's holds the middle of the
   * stage still, which is where the same step lands for a view with no scroll under it.
   */
  const handleZoom = (step: number) => () => {
    const { store } = app.value;

    if (isFlow()) {
      store.dispatch(streamZoomLevelAction$(step, ViewKind.flow));
      return;
    }

    const { editor } = store.state;
    const center = {
      x: editor.viewport.width / 2,
      y: editor.viewport.height / 2,
    };
    updateGraphView(editor.id, ({ state }) =>
      zoomAt(state, center, (state.scale + step) / state.scale)
    );
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

  /**
   * Read again on the press rather than closed over, as the ERD's own compass
   * reads it: a wheel between the render that drew the arrow and the press
   * moves the screen, and what was nearest then may not be nearest now.
   */
  const handleCompass = () => {
    const { store } = app.value;

    if (isFlow()) {
      const compass = getContentCompass(store.state, ViewKind.flow);
      if (!compass) return;

      const origin = getScrollToCenter(
        getViewTransform(store.state, ViewKind.flow),
        compass.target
      );
      store.dispatch(
        sceneScrollToAction(ViewKind.flow, {
          originX: origin.x,
          originY: origin.y,
        })
      );
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
                size={ARROW_SIZE}
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
