import { Store } from '@@types/engine/store';
import { selectEndMemo, addMemo } from './memo.command.helper';

export function* addMemo$(store: Store) {
  // yield selectEndTable();
  yield selectEndMemo();
  yield addMemo(store);
}
