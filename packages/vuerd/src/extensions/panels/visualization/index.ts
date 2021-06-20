import { mdiChartBubble } from '@mdi/js';

import { addIcon } from '@/core';
import { createMDI } from '@/core/icon';
import { PanelConfig } from '@@types/index';

import { VisualizationPanel } from './components';

addIcon(createMDI('chart-bubble', mdiChartBubble));

const visualizationPanelConfig: PanelConfig = {
  type: VisualizationPanel,
  icon: {
    prefix: 'mdi',
    name: 'chart-bubble',
    size: 24,
  },
  key: 'Visualization',
  name: 'Visualization',
};

export const visualizationPanel = () => visualizationPanelConfig;
