import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { updateGraphView } from './graphViewHandle';
import * as styles from './Visualization.styles';
import VisualizationToolbar from './visualization-toolbar/VisualizationToolbar';
import VisualizationFlow from './VisualizationFlow';
import VisualizationGraph from './VisualizationGraph';
import { zoomAt } from './visualizationView';

export type VisualizationProps = {};

/** What each of the three zoom chords does to a scale, as a factor of the one it stands at. */
const GRAPH_ZOOM: Record<string, (scale: number) => number> = {
  [KeyBindingName.zoomIn]: scale => (scale + ZOOM_STEP) / scale,
  [KeyBindingName.zoomOut]: scale => (scale - ZOOM_STEP) / scale,
  [KeyBindingName.zoomReset]: scale => ZOOM_RESET / scale,
};

/**
 * The tab, which mounts one of its two modes at a time and the toolbar that
 * picks between them. Each mode builds its own Stage on mount, so the choice
 * is which sibling stands here rather than a branch inside one of them.
 */
const Visualization: FC<VisualizationProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  /**
   * The three zoom chords, in the mode that is up. The stop chord is not here
   * on purpose: it cancels an ELK ask and nothing else, and a reader pressing
   * it must not find the display set they narrowed to widened under them.
   */
  const handleShortcut = ({ type }: { type: KeyBindingName }) => {
    const { store } = app.value;
    const { editor } = store.state;

    // Quick search is the one overlay that stands over this tab, and a chord
    // typed into it belongs to the palette, which is what the ERD's own gate
    // says of the same chord over its canvas.
    if (editor.openMap[Open.search]) return;

    if (editor.visualizationMode === VisualizationMode.flow) {
      type === KeyBindingName.zoomIn &&
        store.dispatch(streamZoomLevelAction$(ZOOM_STEP, ViewKind.flow));
      type === KeyBindingName.zoomOut &&
        store.dispatch(streamZoomLevelAction$(-ZOOM_STEP, ViewKind.flow));
      // Absolute rather than a run of steps, so it holds the middle of the
      // screen the way the bar's own zoom does.
      type === KeyBindingName.zoomReset &&
        store.dispatch(changeZoomLevelAction$(ZOOM_RESET, ViewKind.flow));
      return;
    }

    const factor = GRAPH_ZOOM[type];
    if (!factor) return;

    const { viewport } = editor;
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    updateGraphView(editor.id, ({ state }) =>
      zoomAt(state, center, factor(state.scale))
    );
  };

  onMounted(() => {
    addUnsubscribe(app.value.shortcut$.subscribe(handleShortcut));
  });

  return () => {
    const { visualizationMode } = app.value.store.state.editor;

    return (
      <div class={styles.root}>
        {visualizationMode === VisualizationMode.flow ? (
          <VisualizationFlow />
        ) : (
          <VisualizationGraph />
        )}
        <VisualizationToolbar />
      </div>
    );
  };
};

export default Visualization;
