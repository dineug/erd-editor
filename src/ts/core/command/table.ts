import { CommandEffect } from "../Command";
import { SIZE_MIN_WIDTH } from "../Layout";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { TableUI } from "../store/Table";
import { TableModel } from "../model/TableModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";
import { selectEndMemoExecute } from "./memo";

export interface AddTable {
  id: string;
  ui: TableUI;
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
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH
      }
    }
  };
}
export function addTableExecute(store: Store, data: AddTable) {
  const { tables } = store.tableState;
  selectEndTableExecute(store);
  selectEndMemoExecute(store);
  tables.push(new TableModel({ addTable: data }));
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
            .filter(table => table.ui.active)
            .map(table => table.id)
        : [tableId],
      memoIds: ctrlKey
        ? memoState.memos.filter(memo => memo.ui.active).map(memo => memo.id)
        : []
    }
  };
}
export function moveTableExecute(store: Store, data: MoveTable) {
  const { tableState, memoState } = store;
  data.tableIds.forEach(tableId => {
    const table = getData(tableState.tables, tableId);
    if (table) {
      table.ui.left += data.movementX;
      table.ui.top += data.movementY;
    }
  });
  data.memoIds.forEach(memoId => {
    const memo = getData(memoState.memos, memoId);
    if (memo) {
      memo.ui.left += data.movementX;
      memo.ui.top += data.movementY;
    }
  });
}

export interface RemoveTable {
  tableIds: string[];
  memoIds: string[];
}
export function removeTable(store: Store): CommandEffect<RemoveTable> {
  const { tableState, memoState } = store;
  return {
    name: "table.remove",
    data: {
      tableIds: tableState.tables
        .filter(table => table.ui.active)
        .map(table => table.id),
      memoIds: memoState.memos
        .filter(memo => memo.ui.active)
        .map(memo => memo.id)
    }
  };
}
export function removeTableExecute(store: Store, data: RemoveTable) {
  const { tableState, memoState } = store;
  for (let i = 0; i < tableState.tables.length; i++) {
    const id = tableState.tables[i].id;
    if (data.tableIds.some(tableId => tableId === id)) {
      tableState.tables.splice(i, 1);
      i--;
    }
  }
  for (let i = 0; i < memoState.memos.length; i++) {
    const id = memoState.memos[i].id;
    if (data.memoIds.some(memoId => memoId === id)) {
      memoState.memos.splice(i, 1);
      i--;
    }
  }
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
      zIndex: nextZIndex(tableState.tables, memoState.memos)
    }
  };
}
export function selectTableExecute(store: Store, data: SelectTable) {
  const { tables } = store.tableState;
  const targetTable = getData(tables, data.tableId);
  if (targetTable) {
    targetTable.ui.zIndex = data.zIndex;
    if (data.ctrlKey) {
      targetTable.ui.active = true;
    } else {
      tables.forEach(table => {
        table.ui.active = table.id === data.tableId;
      });
      selectEndMemoExecute(store);
    }
  }
}

export function selectEndTable(): CommandEffect<null> {
  return {
    name: "table.selectEnd",
    data: null
  };
}
export function selectEndTableExecute(store: Store) {
  const { tables } = store.tableState;
  tables.forEach(table => (table.ui.active = false));
}

export function selectAllTable(): CommandEffect<null> {
  return {
    name: "table.selectAll",
    data: null
  };
}
export function selectAllTableExecute(store: Store) {
  const { tables } = store.tableState;
  tables.forEach(table => (table.ui.active = true));
}
