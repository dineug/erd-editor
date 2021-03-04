import { Store } from '@@types/engine/store';
import { selectEndMemo, addMemo, selectMemo } from './memo.cmd.helper';
import { selectEndTable$ } from './table.cmd.helper';

export function* addMemo$(store: Store, active = true) {
  yield selectEndTable$();
  yield selectEndMemo();
  yield addMemo(store, active);
}

export function* selectMemo$(store: Store, ctrlKey: boolean, memoId: string) {
  yield selectMemo(store, ctrlKey, memoId);
  if (!ctrlKey) {
    yield selectEndTable$();
  }
}
