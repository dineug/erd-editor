import { DefaultStyle } from '@/components/css/index';
import { IconStyle } from '@/components/Icon.style';

import { TuiGridStyle } from './css/tui-grid.style';
import { TuiGridThemeStyle } from './css/tui-grid-theme.style';
import { FilterStyle } from './filter/Filter.style';
import { FilterInputStyle } from './filter/FilterInput.style';
import { FilterItemStyle } from './filter/FilterItem.style';
import { FilterRadioEditorStyle } from './filter/FilterRadioEditor.style';
import { ColumnDataTypeEditorStyle } from './grid/ColumnDataTypeEditor.style';
import { ColumnOptionEditorStyle } from './grid/ColumnOptionEditor.style';
import { GridTextEditorStyle } from './grid/GridTextEditor.style';
import { GridTextRenderStyle } from './grid/GridTextRender.style';
import { GridEditorStyle } from './GridEditor.style';

export const IndexStyle = [
  TuiGridStyle,
  TuiGridThemeStyle,
  DefaultStyle,
  GridEditorStyle,
  FilterStyle,
  FilterRadioEditorStyle,
  FilterItemStyle,
  FilterInputStyle,
  GridTextRenderStyle,
  GridTextEditorStyle,
  ColumnOptionEditorStyle,
  ColumnDataTypeEditorStyle,
  IconStyle,
].join('');
