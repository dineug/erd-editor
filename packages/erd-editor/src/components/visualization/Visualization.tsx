import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { stepFlowView } from '@/components/flowCenters';
import { Open } from '@/constants/open';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import { CenterStep, VisualizationMode } from '@/engine/modules/editor/state';
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
   * The three zoom chords in either mode, and in the Flow undo and redo, which step
   * through the centers it stood on while the document's history stands still. Stop
   * is not here: it cancels an ELK ask and must not widen what the reader narrowed.
   */
  const handleShortcut = ({ type }: { type: KeyBindingName }) => {
    const { editor } = app.value.store.state;

    // Quick search is the one overlay that stands over this tab, and a chord
    // typed into it belongs to the palette, which is what the ERD's own gate
    // says of the same chord over its canvas.
    if (editor.openMap[Open.search]) return;

    if (editor.visualizationMode === VisualizationMode.flow) {
      type === KeyBindingName.undo &&
        stepFlowView(app.value, CenterStep.previous);
      type === KeyBindingName.redo && stepFlowView(app.value, CenterStep.next);
    }

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
