import { PanelConfig } from '@@types/index';

import { GridPanel } from './components';

const gridPanelConfig: PanelConfig = {
  type: GridPanel,
  icon: {
    prefix: 'fas',
    name: 'list',
  },
  key: 'Grid',
  name: 'Grid',
};

export const gridPanel = () => gridPanelConfig;
