import { CommandEffect } from "../Command";
import { SIZE_MIN_WIDTH } from "../Layout";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { Column, TableUI } from "../store/Table";
import { TableModel } from "../model/TableModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";

export interface TableAdd {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;
}
export function tableAdd(
  store: Store,
  effect = () => {}
): CommandEffect<TableAdd> {
  const point = nextPoint(
    store,
    store.tableState.tables,
    store.memoState.memos
  );
  return {
    name: "table.add",
    data: {
      id: uuid(),
      name: "",
      comment: "",
      columns: [],
      ui: {
        active: true,
        left: point.left,
        top: point.top,
        zIndex: nextZIndex(store.tableState.tables, store.memoState.memos),
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH
      }
    },
    effect
  };
}
export function tableAddExecute(store: Store, data: TableAdd) {
  const { tables } = store.tableState;
  tables.push(new TableModel(data));
  store.tableState.tables = [...tables];
}

export interface TableMove {
  movementX: number;
  movementY: number;
  tableIds: string[];
  memoIds: string[];
}
export function tableMove(
  store: Store,
  ctrlKey: boolean,
  movementX: number,
  movementY: number,
  tableId: string,
  effect = () => {}
): CommandEffect<TableMove> {
  const { tableState, memoState } = store;
  return {
    name: "table.move",
    effect,
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
export function tableMoveExecute(store: Store, data: TableMove) {
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
