import { CommandEffect } from "../Command";
import { SIZE_MIN_WIDTH, SIZE_TABLE_PADDING } from "../Layout";
import { Store } from "../Store";
import { Helper, getData, uuid } from "../Helper";
import { Point, relationshipSort } from "../helper/RelationshipHelper";
import { Logger } from "../Logger";
import { TableModel } from "../model/TableModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";
import { executeSelectEndMemo } from "./memo";
import {
  executeFocusTable,
  executeFocusEndTable,
  executeDrawStartAddRelationship,
  executeDrawEndRelationship,
} from "./editor";
import { addRelationship } from "./relationship";

const TABLE_PADDING = SIZE_TABLE_PADDING * 2;

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
export function addTable(store: Store): CommandEffect<AddTable> {
  const { tableState, memoState } = store;
  const point = nextPoint(store, tableState.tables, memoState.memos);
  return {
    name: "table.add",
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
): CommandEffect<MoveTable> {
  const { tableState, memoState } = store;
  return {
    name: "table.move",
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
  memoIds: string[];
}
export function removeTable(
  store: Store,
  tableId?: string
): CommandEffect<RemoveTable> {
  const { tableState, memoState } = store;
  return {
    name: "table.remove",
    data: {
      tableIds: tableId
        ? [tableId]
        : tableState.tables
            .filter((table) => table.ui.active)
            .map((table) => table.id),
      memoIds: tableId
        ? []
        : memoState.memos
            .filter((memo) => memo.ui.active)
            .map((memo) => memo.id),
    },
  };
}
export function executeRemoveTable(store: Store, data: RemoveTable) {
  Logger.debug("executeRemoveTable");
  const { tableState, memoState } = store;
  for (let i = 0; i < tableState.tables.length; i++) {
    const id = tableState.tables[i].id;
    if (data.tableIds.some((tableId) => tableId === id)) {
      tableState.tables.splice(i, 1);
      i--;
    }
  }
  for (let i = 0; i < memoState.memos.length; i++) {
    const id = memoState.memos[i].id;
    if (data.memoIds.some((memoId) => memoId === id)) {
      memoState.memos.splice(i, 1);
      i--;
    }
  }
  // TODO: relationship valid
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
): CommandEffect<SelectTable> {
  const { tableState, memoState } = store;
  return {
    name: "table.select",
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
        store.dispatch(
          addRelationship(
            drawRelationship.relationshipType,
            drawRelationship.start.table,
            data.tableId
          )
        );
        executeDrawEndRelationship(store);
      } else {
        executeDrawStartAddRelationship(store, { tableId: data.tableId });
      }
    }
  }
}

export function selectEndTable(): CommandEffect<null> {
  return {
    name: "table.selectEnd",
    data: null,
  };
}
export function executeSelectEndTable(store: Store) {
  Logger.debug("executeSelectEndTable");
  const { tables } = store.tableState;
  tables.forEach((table) => (table.ui.active = false));
  executeFocusEndTable(store);
}

export function selectAllTable(): CommandEffect<null> {
  return {
    name: "table.selectAll",
    data: null,
  };
}
export function executeSelectAllTable(store: Store) {
  Logger.debug("executeSelectAllTable");
  const { tables } = store.tableState;
  tables.forEach((table) => (table.ui.active = true));
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
): CommandEffect<ChangeTableValue> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    name: "table.changeName",
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
): CommandEffect<ChangeTableValue> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    name: "table.changeComment",
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
): CommandEffect<DragSelectTable> {
  return {
    name: "table.dragSelect",
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
      centerX <= max.x &&
      min.y <= centerY &&
      centerY <= max.y;
  });
}
