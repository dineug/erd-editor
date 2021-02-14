import { DefaultStyle } from '@/components/css';
import { ERDStyle } from './ERD.style';
import { CanvasStyle } from './Canvas.style';
import { MemoStyle } from './memo/Memo.style';
import { TableStyle } from './table/Table.style';

export const EditorStyle = [
  DefaultStyle,
  ERDStyle,
  CanvasStyle,
  MemoStyle,
  TableStyle,
].join('');
