import { State } from '@@types/engine/store';
import { PureTable } from '@@types/engine/store/table.state';
import {
  AddTable,
  MoveTable,
  RemoveTable,
  SelectTable,
  SelectOnlyTable,
  ChangeTableValue,
  DragSelectTable,
} from '@@types/engine/command/table.cmd';
import { SIZE_TABLE_PADDING, SIZE_TABLE_BORDER } from '@/core/layout';
import { getData } from '@/core/helper';
import { TableModel } from '@/engine/store/models/table.model';

const TABLE_PADDING = (SIZE_TABLE_PADDING + SIZE_TABLE_BORDER) * 2;
const TABLE_SORT_PADDING = TABLE_PADDING * 4;

export function executeAddTable(
  { tableState: { tables }, canvasState: { show } }: State,
  data: AddTable
) {
  tables.push(new TableModel({ addTable: data }, show));
  // executeFocusTable(store, { tableId: data.id });
}

export function executeMoveTable(
  { tableState: { tables }, memoState: { memos } }: State,
  data: MoveTable
) {
  data.tableIds.forEach(tableId => {
    const table = getData(tables, tableId);
    if (table) {
      table.ui.left += data.movementX;
      table.ui.top += data.movementY;
    }
  });
  data.memoIds.forEach(memoId => {
    const memo = getData(memos, memoId);
    if (memo) {
      memo.ui.left += data.movementX;
      memo.ui.top += data.movementY;
    }
  });
  // relationshipSort(tables, relationships);
}

export function executeRemoveTable(
  { tableState: { tables } }: State,
  data: RemoveTable
) {
  for (let i = 0; i < tables.length; i++) {
    const id = tables[i].id;
    if (data.tableIds.some(tableId => tableId === id)) {
      tables.splice(i, 1);
      i--;
    }
  }
  // relationship valid
  // removeValidTableIndex(store, data.tableIds);
  // removeValidTableRelationship(store, data.tableIds);
}

export function executeSelectTable(
  { tableState: { tables } }: State,
  data: SelectTable
) {
  // const { tables } = store.tableState;
  // const { drawRelationship } = store.editorState;
  const targetTable = getData(tables, data.tableId);
  if (targetTable) {
    targetTable.ui.zIndex = data.zIndex;
    if (data.ctrlKey) {
      targetTable.ui.active = true;
    } else {
      tables.forEach(table => {
        table.ui.active = table.id === data.tableId;
      });
    }
    // executeFocusTable(store, { tableId: data.tableId });
    // if (drawRelationship) {
    //   if (drawRelationship.start) {
    //     const batchCommand: Array<Command<CommandType>> = [];
    //     const addRelationshipCommand = addRelationship(
    //       drawRelationship.relationshipType,
    //       drawRelationship.start.table,
    //       data.tableId
    //     );
    //     const startTable = drawRelationship.start.table;
    //     // create end table column
    //     const createEndColumns: AddCustomColumn[] = [];
    //     const { start, end } = addRelationshipCommand.data;
    //     start.columnIds.forEach((startColumnId, index) => {
    //       const startColumn = getData(startTable.columns, startColumnId);
    //       if (startColumn) {
    //         createEndColumns.push({
    //           tableId: end.tableId,
    //           id: end.columnIds[index],
    //           option: null,
    //           ui: {
    //             active: false,
    //             pk: false,
    //             fk: true,
    //             pfk: false,
    //           },
    //           value: {
    //             name: startColumn.name,
    //             comment: startColumn.comment,
    //             dataType: startColumn.dataType,
    //             default: startColumn.default,
    //             widthName: startColumn.ui.widthName,
    //             widthComment: startColumn.ui.widthComment,
    //             widthDataType: startColumn.ui.widthDataType,
    //             widthDefault: startColumn.ui.widthDefault,
    //           },
    //         });
    //       }
    //     });
    //     batchCommand.push(
    //       {
    //         type: 'column.addCustom',
    //         data: createEndColumns,
    //       },
    //       addRelationshipCommand
    //     );
    //     store.dispatch(...batchCommand);
    //     executeDrawEndRelationship(store);
    //   } else {
    //     executeDrawStartAddRelationship(store, { tableId: data.tableId });
    //   }
    // }
  }
}

export function executeSelectEndTable({ tableState: { tables } }: State) {
  tables.forEach(table => (table.ui.active = false));
  // executeFocusTableEnd(store);
}

export function executeSelectAllTable({ tableState: { tables } }: State) {
  tables.forEach(table => (table.ui.active = true));
}

export function executeSelectOnlyTable(
  { tableState: { tables } }: State,
  data: SelectOnlyTable
) {
  const targetTable = getData(tables, data.tableId);
  if (targetTable) {
    targetTable.ui.zIndex = data.zIndex;
  }
  tables.forEach(table => {
    table.ui.active = table.id === data.tableId;
  });
  // executeSelectEndMemo(store);
}

export function executeChangeTableName(
  { tableState: { tables } }: State,
  data: ChangeTableValue
) {
  const table = getData(tables, data.tableId);
  if (!table) return;

  table.name = data.value;
  table.ui.widthName = data.width;
  // relationshipSort(tables, relationships);
}

export function executeChangeTableComment(
  { tableState: { tables } }: State,
  data: ChangeTableValue
) {
  const table = getData(tables, data.tableId);
  if (!table) return;

  table.comment = data.value;
  table.ui.widthComment = data.width;
  // relationshipSort(tables, relationships);
}

export function executeDragSelectTable(
  { tableState: { tables } }: State,
  data: DragSelectTable
) {
  const { min, max } = data;
  tables.forEach(table => {
    const centerX = table.ui.left + table.width() / 2 + TABLE_PADDING;
    const centerY = table.ui.top + table.height() / 2 + TABLE_PADDING;
    table.ui.active =
      min.x <= centerX &&
      max.x >= centerX &&
      min.y <= centerY &&
      max.y >= centerY;
  });
}

export function executeSortTable({
  tableState: { tables },
  canvasState,
}: State) {
  const canvasWidth = canvasState.width;
  tables.sort((a, b) => a.columns.length - b.columns.length);
  let widthSum = 50;
  let currentHeight = 50;
  let maxHeight = 50;
  tables.forEach(table => {
    const width = table.width() + TABLE_SORT_PADDING;
    const height = table.height() + TABLE_SORT_PADDING;
    if (widthSum + width > canvasWidth) {
      currentHeight += maxHeight;
      maxHeight = 0;
      widthSum = 50;
    }
    if (maxHeight < height) {
      maxHeight = height;
    }
    table.ui.top = currentHeight;
    table.ui.left = widthSum;
    widthSum += width;
  });

  // relationshipSort(tables, relationships);
}

export function executeLoadTable(
  { tableState: { tables }, canvasState: { show } }: State,
  data: PureTable
) {
  tables.push(new TableModel({ loadTable: data }, show));
}

export const executeTableCommandMap = {
  'table.add': executeAddTable,
  'table.move': executeMoveTable,
  'table.remove': executeRemoveTable,
  'table.select': executeSelectTable,
  'table.selectEnd': executeSelectEndTable,
  'table.selectAll': executeSelectAllTable,
  'table.selectOnly': executeSelectOnlyTable,
  'table.changeName': executeChangeTableName,
  'table.changeComment': executeChangeTableComment,
  'table.dragSelect': executeDragSelectTable,
  'table.sort': executeSortTable,
  'table.load': executeLoadTable,
};