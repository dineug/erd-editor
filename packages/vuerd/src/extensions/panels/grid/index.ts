import { PanelConfig } from '@@types/index';

import { GridPanel } from './components';

export const gridPanelConfig: PanelConfig = {
  type: GridPanel,
  icon: {
    prefix: 'fas',
    name: 'list',
  },
  key: 'Grid',
  name: 'Grid',
};
