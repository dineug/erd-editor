import {
  createRef,
  FC,
  observable,
  onMounted,
  onUpdated,
  ref,
} from '@dineug/r-html';
import { fromEvent } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import {
  getContentCompass,
  scrollToNearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import { toolbarCompass } from '@/components/erd/floating-toolbar/ToolbarCompass.template';
import { showAllFlowView } from '@/components/flowCenters';
import ContextMenuContent from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
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
import {
  setVisualizationZoom,
  stepVisualizationZoom,
} from '@/components/visualization/zoomVisualization';
import { Open } from '@/constants/open';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeShowModeAction,
} from '@/engine/modules/editor/view.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getSceneTransform } from '@/konva/scene/viewport';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';
import { toZoomFormat } from '@/utils/validation';

import * as styles from './VisualizationToolbar.styles';

export type VisualizationToolbarProps = {};

const ICON_SIZE = 16;
const CHEVRON_SIZE = 12;
const MENU_ICON_SIZE = 14;

/** Between the top of the trigger and the bottom of the menu it opens. */
const MENU_GAP = 8;

/** The three steps of a card, in the order the menu offers them. */
const SHOW_MODES = [
  { value: ShowMode.nameOnly, title: 'Name only' },
  { value: ShowMode.keysOnly, title: 'Keys only' },
  { value: ShowMode.allFields, title: 'All fields' },
] as const;

const showModeOf = (value?: ShowMode) =>
  SHOW_MODES.find(mode => mode.value === value) ?? SHOW_MODES[0];

/**
 * The bar over the bottom of the Visualization tab: which of the two modes is
 * up, the zoom, the placement tools of the Flow, how much of a card it draws,
 * the way back to the whole document, and which way the content lies and how far once the screen holds none.
 */
const VisualizationToolbar: FC<VisualizationToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const $bar = createRef<HTMLDivElement>();
  const $trigger = createRef<HTMLDivElement>();
  const $menu = createRef<HTMLDivElement>();

  const state = observable({
    showModeOpen: false,
    menuX: 0,
    menuY: 0,
  });

  const isFlow = () =>
    app.value.store.state.editor.visualizationMode === VisualizationMode.flow;

  const handleMode = (value: VisualizationMode) => () => {
    const { store } = app.value;
    state.showModeOpen = false;
    store.dispatch(changeVisualizationModeAction({ value }));
  };

  const handleZoom = (step: number) => () => {
    stepVisualizationZoom(app.value, step);
  };

  const handleZoomReset = () => {
    setVisualizationZoom(app.value, ZOOM_RESET);
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

  /**
   * Anchored to the trigger's own rect and drawn above it, since the bar stands
   * at the bottom edge of the tab and a menu opening downwards from there would
   * hang off the screen.
   */
  const moveMenuToTrigger = () => {
    const trigger = $trigger.value;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - MENU_GAP;

    // Written only on a move, or the pass this runs after would schedule the
    // next one and the two would hand the anchor back and forth for ever.
    if (state.menuX !== x) state.menuX = x;
    if (state.menuY !== y) state.menuY = y;
  };

  const handleShowModeTrigger = () => {
    if (state.showModeOpen) {
      state.showModeOpen = false;
      return;
    }

    if (!$trigger.value) return;

    moveMenuToTrigger();
    state.showModeOpen = true;
  };

  const handleShowMode = (value: ShowMode) => () => {
    const { store } = app.value;
    state.showModeOpen = false;
    store.dispatch(viewChangeShowModeAction({ value, kind: ViewKind.flow }));
  };

  /**
   * The press is read off the tree the bar stands in rather than off the
   * window: the element's shadow root is closed, and a window listener is
   * handed the host as the target of everything inside it, composed path included.
   */
  const handlePress = (event: Event) => {
    if (!state.showModeOpen) return;

    const target = event.target as Node | null;
    if (!target) return;
    if ($menu.value?.contains(target) || $trigger.value?.contains(target)) {
      return;
    }

    state.showModeOpen = false;
  };

  // Quick search is the one overlay that stands over this tab, and the chord
  // typed into it belongs to the palette, which is what the tab's own gate
  // says of the same stream.
  const handleShortcut = ({ type }: { type: KeyBindingName }) => {
    if (type !== KeyBindingName.stop) return;
    if (app.value.store.state.editor.openMap[Open.search]) return;
    state.showModeOpen = false;
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

  onMounted(() => {
    addUnsubscribe(
      app.value.shortcut$.subscribe(handleShortcut),
      fromEvent($bar.value.getRootNode(), 'mousedown').subscribe(handlePress)
    );
  });

  // The bar is centred, so a tool joining or leaving it slides the trigger
  // sideways under an open menu. Every such change comes through a pass of
  // this component, which is where the anchor is taken again.
  onUpdated(() => {
    if (!state.showModeOpen) return;
    moveMenuToTrigger();
  });

  return () => {
    const { store, keyBindingMap } = app.value;
    const { editor } = store.state;
    const title = (name: string, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, name, keyBindingName);
    const flow = editor.visualizationMode === VisualizationMode.flow;
    const view = editor.views.flow;
    const graph = getGraphView(editor.id);
    const zoomLevel = flow
      ? getSceneTransform(store.state, ViewKind.flow).zoomLevel
      : graph.state.scale;
    const showMode = showModeOf(view?.showMode);
    const showAll = flow && Boolean(view?.centerIds.length);
    const compass = flow
      ? getContentCompass(store.state, ViewKind.flow)
      : graphCompass(graph.state, graph.nodes(), editor.viewport);

    return (
      <>
        <div
          use:ref={ref($bar)}
          class={['visualization-toolbar', floating.root]}
        >
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
          <div class={floating.divider}></div>
          <div
            class={floating.menu}
            title={title('Zoom out', KeyBindingName.zoomOut)}
            on:click={handleZoom(-ZOOM_STEP)}
          >
            <Icon name="minus" size={ICON_SIZE} />
          </div>
          <div
            class={['zoom-level', floating.readout]}
            title={title('Reset zoom', KeyBindingName.zoomReset)}
            on:click={handleZoomReset}
          >
            {toZoomFormat(zoomLevel)}
          </div>
          <div
            class={floating.menu}
            title={title('Zoom in', KeyBindingName.zoomIn)}
            on:click={handleZoom(ZOOM_STEP)}
          >
            <Icon name="plus" size={ICON_SIZE} />
          </div>
          <div class={floating.divider}></div>
          <div class={floating.menu} title="Fit" on:click={handleFit}>
            <Icon name="fullscreen" size={ICON_SIZE} />
          </div>
          {flow ? (
            <>
              <div
                class={floating.menu}
                title="Tidy Up"
                on:click={handleTidyUp}
              >
                <Icon name="wand-sparkles" size={ICON_SIZE} />
              </div>
              <div class={floating.divider}></div>
              <div
                use:ref={ref($trigger)}
                class={[styles.showModeTrigger, { active: state.showModeOpen }]}
                title={`Row display: ${showMode.title}`}
                on:click={handleShowModeTrigger}
              >
                <div class={styles.showModeLabel}>{showMode.title}</div>
                <Icon name="chevron-down" size={CHEVRON_SIZE} />
              </div>
            </>
          ) : null}
          {showAll ? (
            <>
              <div class={floating.divider}></div>
              <div
                class={floating.menu}
                title="Show all"
                on:click={handleShowAll}
              >
                <Icon name="maximize" size={ICON_SIZE} />
              </div>
            </>
          ) : null}
          {toolbarCompass({ compass, onClick: handleCompass })}
        </div>
        {flow && state.showModeOpen ? (
          <div
            use:ref={ref($menu)}
            class={['visualization-show-mode-menu', styles.showModeMenu]}
          >
            <ContextMenuContent
              id="visualization-show-mode"
              x={state.menuX}
              y={state.menuY}
              children={
                <>
                  {SHOW_MODES.map(mode => (
                    <ContextMenu.Item
                      onClick={handleShowMode(mode.value)}
                      children={
                        <ContextMenu.Menu
                          icon={
                            showMode.value === mode.value ? (
                              <Icon name="check" size={MENU_ICON_SIZE} />
                            ) : null
                          }
                          name={mode.title}
                        />
                      }
                    />
                  ))}
                </>
              }
            />
          </div>
        ) : null}
      </>
    );
  };
};

export default VisualizationToolbar;
