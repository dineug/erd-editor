import { DefaultStyle } from '@/components/css';
import { ERDStyle } from './ERD.style';
import { CanvasStyle } from './Canvas.style';
import { MemoStyle } from './memo/Memo.style';
import { TableStyle } from './table/Table.style';
import { InputStyle } from './Input.style';
import { ColumnStyle } from './table/column/Column.style';
import { ColumnKeyStyle } from './table/column/ColumnKey.style';
import { ColumnDataTypeStyle } from './table/column/ColumnDataType.style';
import { ColumnNotNullStyle } from './table/column/ColumnNotNull.style';
import { ColumnUniqueStyle } from './table/column/ColumnUnique.style';
import { ColumnAutoIncrementStyle } from './table/column/ColumnAutoIncrement.style';

export const EditorStyle = [
  DefaultStyle,
  ERDStyle,
  CanvasStyle,
  MemoStyle,
  TableStyle,
  InputStyle,
  ColumnStyle,
  ColumnKeyStyle,
  ColumnDataTypeStyle,
  ColumnNotNullStyle,
  ColumnUniqueStyle,
  ColumnAutoIncrementStyle,
].join('');
