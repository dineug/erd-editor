import { Store } from '../store';
import { CommandType } from './index';

export declare function addColumn$(
  store: Store,
  tableId?: string
): Generator<CommandType<'column.add'> | CommandType<'editor.focusColumn'>>;

export declare function removeColumn$(
  store: Store,
  tableId: string,
  columnIds: string[]
): Generator<
  | CommandType<'column.remove'>
  | CommandType<'editor.focusTable'>
  | CommandType<'editor.focusColumn'>
>;

export declare function changeColumnPrimaryKey$(
  store: Store,
  tableId: string,
  columnId: string
): Generator<
  CommandType<'column.changePrimaryKey'> | CommandType<'column.changeNotNull'>
>;

export declare function moveColumn$(
  tableId: string,
  columnIds: string[],
  targetTableId: string,
  targetColumnId: string
): Generator<
  CommandType<'column.move'> | CommandType<'editor.draggableColumn'>
>;
