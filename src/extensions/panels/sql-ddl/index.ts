import { PanelConfig } from '@@types/index';
import { SQLDDLPanel } from './components';

export const SQLDDLPanelConfig: PanelConfig = {
  type: SQLDDLPanel,
  icon: {
    prefix: 'mdi',
    name: 'database-export',
    size: 20,
  },
  key: 'SQL',
  name: 'SQL DDL',
};
