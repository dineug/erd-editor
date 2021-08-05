import { getData, uuid } from '@/core/helper';
import { createCommand } from '@/engine/command/helper';
import { Helper } from '@@types/core/helper';
import { AddCustomColumn } from '@@types/engine/command/column.cmd';
import { Store } from '@@types/engine/store';

import { ColumnModel } from '../store/models/column.model';
import { loadColumn } from './column.cmd.helper';
import {
  drawEndRelationship,
  drawStartAddRelationship$,
  focusTable,
  focusTableEnd,
} from './editor.cmd.helper';
import { selectEndMemo } from './memo.cmd.helper';
import { addRelationship } from './relationship.cmd.helper';
import { addTable, selectEndTable, selectTable } from './table.cmd.helper';

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
    const endTable = getData(store.tableState.tables, tableId);
    const fkName: string =
      `fk_${drawRelationship.start.table.name}_to_${endTable?.name}`.toLowerCase();

    const addRelationshipCmd = addRelationship(
      drawRelationship.relationshipType,
      drawRelationship.start.table,
      tableId,
      fkName
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
        option: {
          autoIncrement: false,
          primaryKey: false,
          unique: false,
          notNull: true,
        },
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

    yield createCommand('column.addCustom', createEndColumns);
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

export function* addTableDefault$(tableId: string, helper: Helper) {
  const idCol = new ColumnModel({
    addColumn: { tableId: tableId, id: uuid() },
  });
  idCol.name = 'id';
  idCol.dataType = 'INT';
  idCol.option.autoIncrement = true;
  idCol.option.primaryKey = true;
  idCol.ui.pk = true;

  const createdAt = new ColumnModel({
    addColumn: { tableId, id: uuid() },
  });
  createdAt.name = 'created_at';
  createdAt.dataType = 'timestamp';
  createdAt.ui.widthName = helper.getTextWidth('created_at');

  const updatedAt = new ColumnModel({
    addColumn: { tableId, id: uuid() },
  });
  updatedAt.name = 'updated_at';
  updatedAt.dataType = 'timestamp';
  createdAt.ui.widthName = helper.getTextWidth('updated_at');
  createdAt.ui.widthDataType = helper.getTextWidth('timestamp');

  yield loadColumn(tableId, [updatedAt, createdAt, idCol], []);
}
