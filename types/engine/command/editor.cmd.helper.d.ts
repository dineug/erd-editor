import { CommandType } from './index';
import { ColumnType } from '../store/canvas.state';
import { TableType, MoveKey } from '../store/editor.state';

export * from './editor.cmd.helper.gen';

export declare function hasUndoRedo(
  hasUndo: boolean,
  hasRedo: boolean
): CommandType<'editor.hasUndoRedo'>;

export declare function focusTable(
  tableId: string,
  focusType: TableType
): CommandType<'editor.focusTable'>;

export declare function focusColumn(
  tableId: string,
  columnId: string,
  focusType: ColumnType,
  ctrlKey: boolean,
  shiftKey: boolean
): CommandType<'editor.focusColumn'>;

export declare function focusTableEnd(): CommandType<'editor.focusTableEnd'>;

export declare function focusMoveTable(
  moveKey: MoveKey,
  shiftKey: boolean
): CommandType<'editor.focusMoveTable'>;
