import { Store } from '@@types/engine/store';
import { addColumn } from './column.cmd.helper';
import { focusColumn } from './editor.cmd.helper';

export function* addColumn$(store: Store, tableId?: string) {
  const addColumnCmd = addColumn(store, tableId);
  yield addColumnCmd;
  const column = addColumnCmd.data[addColumnCmd.data.length - 1];
  yield focusColumn(column.tableId, column.id, 'columnName', false, false);
}
