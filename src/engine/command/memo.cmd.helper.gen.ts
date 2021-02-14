import { Store } from '@@types/engine/store';
import { selectEndMemo, addMemo } from './memo.cmd.helper';
import { selectEndTable } from './table.cmd.helper';

export function* addMemo$(store: Store) {
  yield selectEndTable();
  yield selectEndMemo();
  yield addMemo(store);
}
