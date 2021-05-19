import { PanelConfig } from '@@types/index';
import { GeneratorCodePanel } from './components';

export const generatorCodePanelConfig: PanelConfig = {
  type: GeneratorCodePanel,
  icon: {
    prefix: 'fas',
    name: 'file-code',
  },
  key: 'GeneratorCode',
  name: 'Generator Code',
};
