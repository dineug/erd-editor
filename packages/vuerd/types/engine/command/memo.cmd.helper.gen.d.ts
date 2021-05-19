import { Store } from '../store';
import { CommandType } from './index';
import { selectEndTable$ } from './table.com.helper';

export declare function addMemo$(
  store: Store,
  active?: boolean
): Generator<
  | CommandType<'memo.selectEnd'>
  | CommandType<'memo.add'>
  | ReturnType<typeof selectEndTable$>
>;

export declare function selectMemo$(
  store: Store,
  ctrlKey: boolean,
  memoId: string
): Generator<CommandType<'memo.select'> | ReturnType<typeof selectEndTable$>>;
