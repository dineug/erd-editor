import { ColumnType } from '../store/canvas.state';
import { TableType } from '../store/editor.state';

export interface HasUndoRedo {
  hasUndo: boolean;
  hasRedo: boolean;
}

export interface FocusTable {
  tableId: string;
  focusType: TableType;
}

export interface FocusColumn {
  tableId: string;
  columnId: string;
  focusType: ColumnType;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface EditorCommandMap {
  'editor.hasUndoRedo': HasUndoRedo;
  'editor.focusTable': FocusTable;
  'editor.focusColumn': FocusColumn;
}
