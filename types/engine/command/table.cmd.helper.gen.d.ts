import { Store } from '../store';
import { CommandType } from './index';

export declare function addTable$(
  store: Store
): Generator<
  | CommandType<'table.selectEnd'>
  | CommandType<'memo.selectEnd'>
  | CommandType<'table.add'>
>;
