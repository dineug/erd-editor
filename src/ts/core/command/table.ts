import { Command, CommandType } from "../Command";
import {
  SIZE_MIN_WIDTH,
  SIZE_TABLE_PADDING,
  SIZE_TABLE_BORDER,
} from "../Layout";
import { Store } from "../Store";
import { Helper, getData, uuid } from "../Helper";
import {
  Point,
  relationshipSort,
  removeTableRelationshipValid,
} from "../helper/RelationshipHelper";
import { Logger } from "../Logger";
import { TableModel } from "../model/TableModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";
import { executeSelectEndMemo } from "./memo";
import {
  executeFocusTable,
  executeFocusTableEnd,
  executeDrawStartAddRelationship,
  executeDrawEndRelationship,
} from "./editor";
import { TableUI, Column } from "../store/Table";
import { addRelationship } from "./relationship";
import { AddCustomColumn } from "./column";

const TABLE_PADDING = (SIZE_TABLE_PADDING + SIZE_TABLE_BORDER) * 2;
const TABLE_SORT_PADDING = TABLE_PADDING * 4;

interface AddTableUI {
  active: boolean;
  top: number;
  left: number;
  zIndex: number;
}
export interface AddTable {
  id: string;
  ui: AddTableUI;
}
export function addTable(store: Store): Command<"table.add"> {
  const { tableState, memoState } = store;
  const point = nextPoint(store, tableState.tables, memoState.memos);
  return {
    type: "table.add",
    data: {
      id: uuid(),
      ui: {
        active: true,
        left: point.left,
        top: point.top,
        zIndex: nextZIndex(tableState.tables, memoState.memos),
      },
    },
  };
}
export function executeAddTable(store: Store, data: AddTable) {
  Logger.debug("executeAddTable");
  const { tables } = store.tableState;
  executeSelectEndTable(store);
  executeSelectEndMemo(store);
  tables.push(new TableModel({ addTable: data }, store.canvasState.show));
  executeFocusTable(store, { tableId: data.id });
}

export interface MoveTable {
  movementX: number;
  movementY: number;
  tableIds: string[];
  memoIds: string[];
}
export function moveTable(
  store: Store,
  ctrlKey: boolean,
  movementX: number,
  movementY: number,
  tableId: string
): Command<"table.move"> {
  const { tableState, memoState } = store;
  return {
    type: "table.move",
    data: {
      movementX,
      movementY,
      tableIds: ctrlKey
        ? tableState.tables
            .filter((table) => table.ui.active)
            .map((table) => table.id)
        : [tableId],
      memoIds: ctrlKey
        ? memoState.memos
            .filter((memo) => memo.ui.active)
            .map((memo) => memo.id)
        : [],
    },
  };
}
export function executeMoveTable(store: Store, data: MoveTable) {
  Logger.debug("executeMoveTable");
  const { tables } = store.tableState;
  const { memos } = store.memoState;
  const { relationships } = store.relationshipState;
  data.tableIds.forEach((tableId) => {
    const table = getData(tables, tableId);
    if (table) {
      table.ui.left += data.movementX;
      table.ui.top += data.movementY;
    }
  });
  data.memoIds.forEach((memoId) => {
    const memo = getData(memos, memoId);
    if (memo) {
      memo.ui.left += data.movementX;
      memo.ui.top += data.movementY;
    }
  });
  relationshipSort(tables, relationships);
}

export interface RemoveTable {
  tableIds: string[];
}
export function removeTable(
  store: Store,
  tableId?: string
): Command<"table.remove"> {
  const { tables } = store.tableState;
  return {
    type: "table.remove",
    data: {
      tableIds: tableId
        ? [tableId]
        : tables.filter((table) => table.ui.active).map((table) => table.id),
    },
  };
}
export function executeRemoveTable(store: Store, data: RemoveTable) {
  Logger.debug("executeRemoveTable");
  const { tables } = store.tableState;
  for (let i = 0; i < tables.length; i++) {
    const id = tables[i].id;
    if (data.tableIds.some((tableId) => tableId === id)) {
      tables.splice(i, 1);
      i--;
    }
  }
  // relationship valid
  removeTableRelationshipValid(store, data.tableIds);
}

export interface SelectTable {
  ctrlKey: boolean;
  tableId: string;
  zIndex: number;
}
export function selectTable(
  store: Store,
  ctrlKey: boolean,
  tableId: string
): Command<"table.select"> {
  const { tableState, memoState } = store;
  return {
    type: "table.select",
    data: {
      ctrlKey,
      tableId,
      zIndex: nextZIndex(tableState.tables, memoState.memos),
    },
  };
}
export function executeSelectTable(store: Store, data: SelectTable) {
  Logger.debug("executeSelectTable");
  const { tables } = store.tableState;
  const { drawRelationship } = store.editorState;
  const targetTable = getData(tables, data.tableId);
  if (targetTable) {
    targetTable.ui.zIndex = data.zIndex;
    if (data.ctrlKey) {
      targetTable.ui.active = true;
    } else {
      tables.forEach((table) => {
        table.ui.active = table.id === data.tableId;
      });
      executeSelectEndMemo(store);
    }
    executeFocusTable(store, { tableId: data.tableId });
    if (drawRelationship) {
      if (drawRelationship.start) {
        const batchCommand: Array<Command<CommandType>> = [];
        const addRelationshipCommand = addRelationship(
          drawRelationship.relationshipType,
          drawRelationship.start.table,
          data.tableId
        );
        const startTable = drawRelationship.start.table;
        // create end table column
        const createEndColumns: AddCustomColumn[] = [];
        const { start, end } = addRelationshipCommand.data;
        start.columnIds.forEach((startColumnId, index) => {
          const startColumn = getData(startTable.columns, startColumnId);
          if (startColumn) {
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
          }
        });
        batchCommand.push(
          {
            type: "column.addCustom",
            data: createEndColumns,
          },
          addRelationshipCommand
        );
        store.dispatch(...batchCommand);
        executeDrawEndRelationship(store);
      } else {
        executeDrawStartAddRelationship(store, { tableId: data.tableId });
      }
    }
  }
}

export function selectEndTable(): Command<"table.selectEnd"> {
  return {
    type: "table.selectEnd",
    data: null,
  };
}
export function executeSelectEndTable(store: Store) {
  Logger.debug("executeSelectEndTable");
  const { tables } = store.tableState;
  tables.forEach((table) => (table.ui.active = false));
  executeFocusTableEnd(store);
}

export function selectAllTable(): Command<"table.selectAll"> {
  return {
    type: "table.selectAll",
    data: null,
  };
}
export function executeSelectAllTable(store: Store) {
  Logger.debug("executeSelectAllTable");
  const { tables } = store.tableState;
  tables.forEach((table) => (table.ui.active = true));
}

export interface SelectOnlyTable {
  tableId: string;
  zIndex: number;
}
export function selectOnlyTable(
  store: Store,
  tableId: string
): Command<"table.selectOnly"> {
  const { tableState, memoState } = store;
  return {
    type: "table.selectOnly",
    data: {
      tableId,
      zIndex: nextZIndex(tableState.tables, memoState.memos),
    },
  };
}
export function executeSelectOnlyTable(store: Store, data: SelectOnlyTable) {
  Logger.debug("executeSelectOnlyTable");
  const { tables } = store.tableState;
  const targetTable = getData(tables, data.tableId);
  if (targetTable) {
    targetTable.ui.zIndex = data.zIndex;
  }
  tables.forEach((table) => {
    table.ui.active = table.id === data.tableId;
  });
  executeSelectEndMemo(store);
}

export interface ChangeTableValue {
  tableId: string;
  value: string;
  width: number;
}

export function changeTableName(
  helper: Helper,
  tableId: string,
  value: string
): Command<"table.changeName"> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    type: "table.changeName",
    data: {
      tableId,
      value,
      width,
    },
  };
}
export function executeChangeTableName(store: Store, data: ChangeTableValue) {
  Logger.debug("executeChangeTableName");
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  const table = getData(tables, data.tableId);
  if (table) {
    table.name = data.value;
    table.ui.widthName = data.width;
    relationshipSort(tables, relationships);
  }
}

export function changeTableComment(
  helper: Helper,
  tableId: string,
  value: string
): Command<"table.changeComment"> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    type: "table.changeComment",
    data: {
      tableId,
      value,
      width,
    },
  };
}
export function executeChangeTableComment(
  store: Store,
  data: ChangeTableValue
) {
  Logger.debug("executeChangeTableComment");
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  const table = getData(tables, data.tableId);
  if (table) {
    table.comment = data.value;
    table.ui.widthComment = data.width;
    relationshipSort(tables, relationships);
  }
}

export interface DragSelectTable {
  min: Point;
  max: Point;
}
export function dragSelectTable(
  min: Point,
  max: Point
): Command<"table.dragSelect"> {
  return {
    type: "table.dragSelect",
    data: {
      min,
      max,
    },
  };
}
export function executeDragSelectTable(store: Store, data: DragSelectTable) {
  Logger.debug("executeDragSelectTable");
  const { tables } = store.tableState;
  const { min, max } = data;
  tables.forEach((table) => {
    const centerX = table.ui.left + table.width() / 2 + TABLE_PADDING;
    const centerY = table.ui.top + table.height() / 2 + TABLE_PADDING;
    table.ui.active =
      min.x <= centerX &&
      max.x >= centerX &&
      min.y <= centerY &&
      max.y >= centerY;
  });
}

export function sortTable(): Command<"table.sort"> {
  return {
    type: "table.sort",
    data: null,
  };
}
export function executeSortTable(store: Store) {
  Logger.debug("executeSortTable");
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  const canvasWidth = store.canvasState.width;
  tables.sort((a, b) => a.columns.length - b.columns.length);
  let widthSum = 50;
  let currentHeight = 50;
  let maxHeight = 50;
  tables.forEach((table) => {
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

  relationshipSort(tables, relationships);
}

export interface LoadTable {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;
}
export function loadTable(table: LoadTable): Command<"table.load"> {
  return {
    type: "table.load",
    data: table,
  };
}
export function executeLoadTable(store: Store, data: LoadTable) {
  Logger.debug("executeLoadTable");
  const { tables } = store.tableState;
  const { show } = store.canvasState;
  tables.push(new TableModel({ loadTable: data }, show));
}
