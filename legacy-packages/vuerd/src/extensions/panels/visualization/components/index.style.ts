import { ScrollbarStyle } from '@/components/css/scrollbar.style';
import { InputStyle } from '@/components/editor/Input.style';
import { ColumnStyle } from '@/components/editor/table/column/Column.style';
import { ColumnAutoIncrementStyle } from '@/components/editor/table/column/ColumnAutoIncrement.style';
import { ColumnDataTypeStyle } from '@/components/editor/table/column/ColumnDataType.style';
import { ColumnKeyStyle } from '@/components/editor/table/column/ColumnKey.style';
import { ColumnNotNullStyle } from '@/components/editor/table/column/ColumnNotNull.style';
import { ColumnUniqueStyle } from '@/components/editor/table/column/ColumnUnique.style';
import { TableStyle } from '@/components/editor/table/Table.style';

import { VisualizationStyle } from './Visualization.style';

export const IndexStyle = [
  VisualizationStyle,
  ScrollbarStyle,
  TableStyle,
  InputStyle,
  ColumnStyle,
  ColumnKeyStyle,
  ColumnDataTypeStyle,
  ColumnNotNullStyle,
  ColumnUniqueStyle,
  ColumnAutoIncrementStyle,
].join('');
