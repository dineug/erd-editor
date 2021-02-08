import { Store } from '../store';
import { CommandType } from './index';

export declare function addMemo$(
  store: Store
): Generator<CommandType<'memo.selectEnd'> | CommandType<'memo.add'>>;
