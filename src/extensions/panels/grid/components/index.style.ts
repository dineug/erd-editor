import { TuiGridStyle } from './css/tui-grid.style';
import { TuiGridThemeStyle } from './css/tui-grid-theme.style';
import { GridStyle } from './Grid.style';
import { DefaultStyle } from '@/components/css/index';

export const IndexStyle = [
  TuiGridStyle,
  TuiGridThemeStyle,
  DefaultStyle,
  GridStyle,
].join('');
