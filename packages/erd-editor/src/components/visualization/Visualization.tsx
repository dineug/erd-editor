import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import { VisualizationMode } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './Visualization.styles';
import VisualizationToolbar from './visualization-toolbar/VisualizationToolbar';
import VisualizationFlow from './VisualizationFlow';
import VisualizationGraph from './VisualizationGraph';
import {
  setVisualizationZoom,
  stepVisualizationZoom,
} from './zoomVisualization';

export type VisualizationProps = {};

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
    // Quick search is the one overlay that stands over this tab, and a chord
    // typed into it belongs to the palette, which is what the ERD's own gate
    // says of the same chord over its canvas.
    if (app.value.store.state.editor.openMap[Open.search]) return;

    type === KeyBindingName.zoomIn &&
      stepVisualizationZoom(app.value, ZOOM_STEP);
    type === KeyBindingName.zoomOut &&
      stepVisualizationZoom(app.value, -ZOOM_STEP);
    // Absolute rather than a run of steps, so it holds the middle of the
    // screen the way the bar's own zoom does.
    type === KeyBindingName.zoomReset &&
      setVisualizationZoom(app.value, ZOOM_RESET);
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
