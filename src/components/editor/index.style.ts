import { DefaultStyle } from '@/components/css';
import { ERDStyle } from './ERD.style';
import { CanvasStyle } from './Canvas.style';
import { MemoStyle } from './memo/Memo.style';
import { TableStyle } from './table/Table.style';
import { InputStyle } from './Input.style';
import { ColumnStyle } from './table/column/Column.style';
import { ColumnKeyStyle } from './table/column/ColumnKey.style';

export const EditorStyle = [
  DefaultStyle,
  ERDStyle,
  CanvasStyle,
  MemoStyle,
  TableStyle,
  InputStyle,
  ColumnStyle,
  ColumnKeyStyle,
].join('');
