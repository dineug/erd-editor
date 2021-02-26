import { Store } from '../store';
import { CommandType } from './index';

export declare function addColumn$(
  store: Store,
  tableId?: string
): Generator<CommandType<'column.add'> | CommandType<'editor.focusColumn'>>;
