import './Visualization';

import { Panel, PanelConfig, ERDEditorContext } from '@@types/index';
import { mdiChartBubble } from '@mdi/js';
import { addIcon } from '@/core';

class VisualizationPanel implements Panel {
  el = document.createElement('vuerd-visualization');

  constructor(api: ERDEditorContext) {}

  render() {
    return this.el;
  }
}

addIcon({
  prefix: 'mdi',
  iconName: 'chart-bubble',
  icon: [24, 24, , , mdiChartBubble],
});

export const visualizationPanelConfig: PanelConfig = {
  type: VisualizationPanel,
  icon: {
    prefix: 'mdi',
    name: 'chart-bubble',
    size: 24,
  },
  key: 'Visualization',
  name: 'Visualization',
};
