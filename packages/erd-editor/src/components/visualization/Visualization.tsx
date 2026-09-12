import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { VisualizationMode } from '@/engine/modules/editor/state';

import * as styles from './Visualization.styles';
import VisualizationToolbar from './visualization-toolbar/VisualizationToolbar';
import VisualizationFlow from './VisualizationFlow';
import VisualizationGraph from './VisualizationGraph';

export type VisualizationProps = {};

/**
 * The tab, which mounts one of its two modes at a time and the toolbar that
 * picks between them. Each mode builds its own Stage on mount, so the choice
 * is which sibling stands here rather than a branch inside one of them.
 */
const Visualization: FC<VisualizationProps> = (props, ctx) => {
  const app = useAppContext(ctx);

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
