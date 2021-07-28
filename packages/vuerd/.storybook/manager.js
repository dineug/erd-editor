import { addons } from '@storybook/addons';
import { theme } from './one-dark.theme';

addons.setConfig({
  theme,
  panelPosition: 'right',
});

window.STORYBOOK_GA_ID = 'UA-131336352-5';
window.STORYBOOK_REACT_GA_OPTIONS = {};
