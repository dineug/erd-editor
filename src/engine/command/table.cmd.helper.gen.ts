import { Store } from '@@types/engine/store';
import { selectEndMemo } from './memo.cmd.helper';
import { selectEndTable, addTable, selectTable } from './table.cmd.helper';
import { focusTableEnd, focusTable } from './editor.cmd.helper';

export function* addTable$(store: Store, active = true) {
  yield selectEndTable();
  yield selectEndMemo();
  const addTableCmd = addTable(store, active);
  yield addTableCmd;
  yield focusTable(addTableCmd.data.id);
}

export function* selectTable$(store: Store, ctrlKey: boolean, tableId: string) {
  yield selectTable(store, ctrlKey, tableId);
  if (!ctrlKey) {
    yield selectEndMemo();
  }
  yield focusTable(tableId);
}

export function* selectEndTable$() {
  yield selectEndTable();
  yield focusTableEnd();
}
