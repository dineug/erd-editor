import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import * as styles from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import Icon from '@/components/primitives/icon/Icon';
import {
  ensureFlowPlaced,
  fitFlowView,
} from '@/components/visualization/flowLayout';
import { VisualizationMode } from '@/engine/modules/editor/state';
import { changeVisualizationModeAction } from '@/engine/modules/editor/view.actions';

export type VisualizationToolbarProps = {};

const ICON_SIZE = 16;

/**
 * The tools over the tab, in the column the ERD's floating toolbar draws:
 * which of the two modes is up, and for Flow the fit and the Tidy up that asks
 * ELK for the placement again. The mode is the reader's for the session, never the file's.
 */
const VisualizationToolbar: FC<VisualizationToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleMode = (value: VisualizationMode) => () => {
    const { store } = app.value;
    store.dispatch(changeVisualizationModeAction({ value }));
  };

  const handleFit = () => {
    fitFlowView(app.value.store);
  };

  const handleTidyUp = () => {
    ensureFlowPlaced(app.value, { force: true });
  };

  return () => {
    const { editor } = app.value.store.state;
    const flow = editor.visualizationMode === VisualizationMode.flow;

    return (
      <div class={['visualization-toolbar', styles.root]}>
        <div
          class={[styles.menu, { active: !flow }]}
          title="Graph"
          on:click={handleMode(VisualizationMode.graph)}
        >
          <Icon name="atom" size={ICON_SIZE} />
        </div>
        <div
          class={[styles.menu, { active: flow }]}
          title="Flow"
          on:click={handleMode(VisualizationMode.flow)}
        >
          <Icon name="waypoints" size={ICON_SIZE} />
        </div>
        {flow ? (
          <>
            <div class={styles.divider}></div>
            <div class={styles.menu} title="Fit" on:click={handleFit}>
              <Icon name="fullscreen" size={ICON_SIZE} />
            </div>
            <div class={styles.menu} title="Tidy Up" on:click={handleTidyUp}>
              <Icon name="wand-sparkles" size={ICON_SIZE} />
            </div>
          </>
        ) : null}
      </div>
    );
  };
};

export default VisualizationToolbar;
