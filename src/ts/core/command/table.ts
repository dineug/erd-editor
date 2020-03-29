import { CommandEffect } from "../Command";
import { SIZE_MIN_WIDTH } from "../Layout";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { Column, TableUI } from "../store/Table";
import { TableModel } from "../model/TableModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";

export interface AddTable {
  id: string;
  ui: TableUI;
}
export function addTable(store: Store): CommandEffect<AddTable> {
  const point = nextPoint(
    store,
    store.tableState.tables,
    store.memoState.memos
  );
  return {
    name: "table.add",
    data: {
      id: uuid(),
      ui: {
        active: true,
        left: point.left,
        top: point.top,
        zIndex: nextZIndex(store.tableState.tables, store.memoState.memos),
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH
      }
    }
  };
}
export function addTableExecute(store: Store, data: AddTable) {
  const { tables } = store.tableState;
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
