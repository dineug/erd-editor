import { PanelConfig } from '@@types/index';
import { mdiChartBubble } from '@mdi/js';
import { createMDI } from '@/core/icon';
import { addIcon } from '@/core';
import { VisualizationPanel } from './components';

addIcon(createMDI('chart-bubble', mdiChartBubble));

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
