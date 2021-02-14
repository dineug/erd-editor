import { Store } from '../store';
import { CommandType } from './index';

export declare function addMemo$(
  store: Store
): Generator<
  | CommandType<'table.selectEnd'>
  | CommandType<'memo.selectEnd'>
  | CommandType<'memo.add'>
>;
