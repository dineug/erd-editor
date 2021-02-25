import { Store } from '../store';
import { CommandType } from './index';

export declare function addTable$(
  store: Store,
  active?: boolean
): Generator<
  | CommandType<'table.selectEnd'>
  | CommandType<'memo.selectEnd'>
  | CommandType<'table.add'>
>;

export declare function selectTable$(
  store: Store,
  ctrlKey: boolean,
  tableId: string
): Generator<CommandType<'table.select'> | CommandType<'memo.selectEnd'>>;
