import { Store } from '@@types/engine/store';
import { ColumnType } from '@@types/engine/store/canvas.state';
import { addColumn, removeColumn } from './column.cmd.helper';
import { focusColumn, focusTable } from './editor.cmd.helper';
import { getRemoveFirstColumnId } from '@/engine/command/helper/editor.focus.helper';

export function* addColumn$(store: Store, tableId?: string) {
  const addColumnCmd = addColumn(store, tableId);
  yield addColumnCmd;
  const column = addColumnCmd.data[addColumnCmd.data.length - 1];
  yield focusColumn(column.tableId, column.id, 'columnName', false, false);
}

export function* removeColumn$(
  store: Store,
  tableId: string,
  columnIds: string[]
) {
  const { editorState } = store;

  if (editorState.focusTable && editorState.focusTable.columnId) {
    const columnId = getRemoveFirstColumnId(editorState.focusTable, columnIds);

    if (columnId) {
      yield focusColumn(
        editorState.focusTable.table.id,
        columnId,
        editorState.focusTable.focusType as ColumnType,
        false,
        false
      );
    } else {
      yield focusTable(editorState.focusTable.table.id, 'tableName');
    }
  }

  yield removeColumn(tableId, columnIds);
}
