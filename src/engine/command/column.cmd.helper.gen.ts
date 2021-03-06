import { Store } from '@@types/engine/store';
import { ColumnType } from '@@types/engine/store/canvas.state';
import {
  addColumn,
  removeColumn,
  changeColumnPrimaryKey,
  changeColumnNotNull,
  moveColumn,
} from './column.cmd.helper';
import { focusColumn, focusTable } from './editor.cmd.helper';
import { getRemoveFirstColumnId } from '@/engine/command/helper/editor.focus.helper';
import { getColumn } from '@/engine/store/helper/column.helper';
import { CommandType } from '@@types/engine/command';

export function* addColumn$(store: Store, tableId?: string) {
  const addColumnCmd = addColumn(store, tableId);
  yield addColumnCmd;
  const column = addColumnCmd.data[addColumnCmd.data.length - 1];
  yield focusColumn(column.tableId, column.id, 'columnName');
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
        editorState.focusTable.focusType as ColumnType
      );
    } else {
      yield focusTable(editorState.focusTable.table.id, 'tableName');
    }
  }

  yield removeColumn(tableId, columnIds);
}

export function* changeColumnPrimaryKey$(
  store: Store,
  tableId: string,
  columnId: string
) {
  const {
    tableState: { tables },
  } = store;
  const changeColumnPrimaryKeyCmd = changeColumnPrimaryKey(
    store,
    tableId,
    columnId
  );

  yield changeColumnPrimaryKeyCmd;

  const column = getColumn(tables, tableId, columnId);
  if (!changeColumnPrimaryKeyCmd.data.value || !column || column.option.notNull)
    return;

  yield changeColumnNotNull(store, tableId, columnId);
}

export function* moveColumn$(
  tableId: string,
  columnIds: string[],
  targetTableId: string,
  targetColumnId: string
) {
  yield moveColumn(tableId, columnIds, targetTableId, targetColumnId);

  if (
    tableId === targetTableId ||
    columnIds.some(columnId => columnId === targetColumnId)
  )
    return;

  yield {
    name: 'editor.draggableColumn',
    data: {
      tableId: targetTableId,
      columnIds,
    },
    timestamp: Date.now(),
  } as CommandType<'editor.draggableColumn'>;
}
