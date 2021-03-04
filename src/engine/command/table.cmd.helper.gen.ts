import { Store } from '@@types/engine/store';
import { CommandType } from '@@types/engine/command';
import { AddCustomColumn } from '@@types/engine/command/column.cmd';
import { selectEndMemo } from './memo.cmd.helper';
import { selectEndTable, addTable, selectTable } from './table.cmd.helper';
import {
  focusTableEnd,
  focusTable,
  drawStartAddRelationship$,
  drawEndRelationship,
} from './editor.cmd.helper';
import { addRelationship } from './relationship.cmd.helper';
import { getData } from '@/core/helper';

export function* addTable$(store: Store, active = true) {
  yield selectEndTable();
  yield selectEndMemo();
  const addTableCmd = addTable(store, active);
  yield addTableCmd;
  yield focusTable(addTableCmd.data.id);
}

export function* selectTable$(store: Store, ctrlKey: boolean, tableId: string) {
  const {
    editorState: { drawRelationship },
  } = store;

  yield selectTable(store, ctrlKey, tableId);
  if (!ctrlKey) {
    yield selectEndMemo();
  }
  yield focusTable(tableId);

  if (!drawRelationship) return;

  if (drawRelationship.start) {
    const addRelationshipCmd = addRelationship(
      drawRelationship.relationshipType,
      drawRelationship.start.table,
      tableId
    );
    const startTable = drawRelationship.start.table;
    const { start, end } = addRelationshipCmd.data;
    const createEndColumns: AddCustomColumn[] = [];

    start.columnIds.forEach((startColumnId, index) => {
      const startColumn = getData(startTable.columns, startColumnId);
      if (!startColumn) return;

      createEndColumns.push({
        tableId: end.tableId,
        id: end.columnIds[index],
        option: null,
        ui: {
          active: false,
          pk: false,
          fk: true,
          pfk: false,
        },
        value: {
          name: startColumn.name,
          comment: startColumn.comment,
          dataType: startColumn.dataType,
          default: startColumn.default,
          widthName: startColumn.ui.widthName,
          widthComment: startColumn.ui.widthComment,
          widthDataType: startColumn.ui.widthDataType,
          widthDefault: startColumn.ui.widthDefault,
        },
      });
    });

    yield {
      name: 'column.addCustom',
      data: createEndColumns,
      timestamp: Date.now(),
    } as CommandType<'column.addCustom'>;
    yield addRelationshipCmd;
    yield drawEndRelationship();
  } else {
    yield drawStartAddRelationship$(store, tableId);
  }
}

export function* selectEndTable$() {
  yield selectEndTable();
  yield focusTableEnd();
}
