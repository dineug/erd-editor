import { Store } from '@@types/engine/store';
import { selectEndMemo } from './memo.cmd.helper';
import { selectEndTable, addTable } from './table.cmd.helper';

export function* addTable$(store: Store) {
  yield selectEndTable();
  yield selectEndMemo();
  yield addTable(store);
}
