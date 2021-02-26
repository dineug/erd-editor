import { ColumnType } from '@@types/engine/store/canvas.state';
import { TableType } from '@@types/engine/store/editor.state';
import { createCommand } from './helper';

export const hasUndoRedo = (hasUndo: boolean, hasRedo: boolean) =>
  createCommand('editor.hasUndoRedo', { hasUndo, hasRedo });

export const focusTable = (tableId: string, focusType?: TableType) =>
  createCommand('editor.focusTable', { tableId, focusType });

export const focusColumn = (
  tableId: string,
  columnId: string,
  focusType: ColumnType,
  ctrlKey: boolean,
  shiftKey: boolean
) =>
  createCommand('editor.focusColumn', {
    tableId,
    columnId,
    focusType,
    ctrlKey,
    shiftKey,
  });

export const focusTableEnd = () => createCommand('editor.focusTableEnd', null);
