import { TuiGridStyle } from './css/tui-grid.style';
import { TuiGridThemeStyle } from './css/tui-grid-theme.style';
import { GridEditorStyle } from './GridEditor.style';
import { DefaultStyle } from '@/components/css/index';
import { FilterStyle } from './filter/Filter.style';
import { FilterRadioEditorStyle } from './filter/FilterRadioEditor.style';
import { FilterItemStyle } from './filter/FilterItem.style';
import { FilterInputStyle } from './filter/FilterInput.style';
import { GridTextRenderStyle } from './grid/GridTextRender.style';
import { GridTextEditorStyle } from './grid/GridTextEditor.style';
import { ColumnOptionEditorStyle } from './grid/ColumnOptionEditor.style';
import { ColumnDataTypeEditorStyle } from './grid/ColumnDataTypeEditor.style';

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
].join('');
