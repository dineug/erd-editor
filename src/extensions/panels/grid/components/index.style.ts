import { TuiGridStyle } from './css/tui-grid.style';
import { TuiGridThemeStyle } from './css/tui-grid-theme.style';
import { GridStyle } from './Grid.style';
import { DefaultStyle } from '@/components/css/index';
import { FilterStyle } from './filter/Filter.style';
import { FilterRadioEditorStyle } from './filter/FilterRadioEditor.style';
import { FilterItemStyle } from './filter/FilterItem.style';
import { FilterInputStyle } from './filter/FilterInput.style';

export const IndexStyle = [
  TuiGridStyle,
  TuiGridThemeStyle,
  DefaultStyle,
  GridStyle,
  FilterStyle,
  FilterRadioEditorStyle,
  FilterItemStyle,
  FilterInputStyle,
].join('');
