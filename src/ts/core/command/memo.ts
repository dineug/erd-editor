import { CommandEffect } from "../Command";
import { SIZE_MEMO_WIDTH, SIZE_MEMO_HEIGHT } from "../Layout";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { MemoUI } from "../store/Memo";
import { MemoModel } from "../model/MemoModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";
import { selectEndTableExecute } from "./table";

export interface AddMemo {
  id: string;
  ui: MemoUI;
}
export function addMemo(store: Store): CommandEffect<AddMemo> {
  const { tableState, memoState } = store;
  const point = nextPoint(store, tableState.tables, memoState.memos);
  return {
    name: "memo.add",
    data: {
      id: uuid(),
      ui: {
        active: true,
        left: point.left,
        top: point.top,
        zIndex: nextZIndex(tableState.tables, memoState.memos),
        width: SIZE_MEMO_WIDTH,
        height: SIZE_MEMO_HEIGHT
      }
    }
  };
}
export function addMemoExecute(store: Store, data: AddMemo) {
  const { memos } = store.memoState;
  selectEndTableExecute(store);
  selectEndMemoExecute(store);
  memos.push(new MemoModel({ addMemo: data }));
}

export interface MoveMemo {
  movementX: number;
  movementY: number;
  tableIds: string[];
  memoIds: string[];
}
export function moveMemo(
  store: Store,
  ctrlKey: boolean,
  movementX: number,
  movementY: number,
  memoId: string
): CommandEffect<MoveMemo> {
  const { tableState, memoState } = store;
  return {
    name: "memo.move",
    data: {
      movementX,
      movementY,
      tableIds: ctrlKey
        ? tableState.tables
            .filter(table => table.ui.active)
            .map(table => table.id)
        : [],
      memoIds: ctrlKey
        ? memoState.memos.filter(memo => memo.ui.active).map(memo => memo.id)
        : [memoId]
    }
  };
}
export function moveMemoExecute(store: Store, data: MoveMemo) {
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

export interface RemoveMemo {
  tableIds: string[];
  memoIds: string[];
}
export function removeMemo(store: Store): CommandEffect<RemoveMemo> {
  const { tableState, memoState } = store;
  return {
    name: "memo.remove",
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
export function removeMemoExecute(store: Store, data: RemoveMemo) {
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

export interface SelectMemo {
  ctrlKey: boolean;
  memoId: string;
  zIndex: number;
}
export function selectMemo(
  store: Store,
  ctrlKey: boolean,
  memoId: string
): CommandEffect<SelectMemo> {
  const { tableState, memoState } = store;
  return {
    name: "memo.select",
    data: {
      ctrlKey,
      memoId,
      zIndex: nextZIndex(tableState.tables, memoState.memos)
    }
  };
}
export function selectMemoExecute(store: Store, data: SelectMemo) {
  const { memos } = store.memoState;
  const targetMemo = getData(memos, data.memoId);
  if (targetMemo) {
    targetMemo.ui.zIndex = data.zIndex;
    if (data.ctrlKey) {
      targetMemo.ui.active = true;
    } else {
      memos.forEach(memo => {
        memo.ui.active = memo.id === data.memoId;
      });
      selectEndTableExecute(store);
    }
  }
}

export function selectEndMemo(): CommandEffect<null> {
  return {
    name: "memo.selectEnd",
    data: null
  };
}
export function selectEndMemoExecute(store: Store) {
  const { memos } = store.memoState;
  memos.forEach(memo => (memo.ui.active = false));
}

export function selectAllMemo(): CommandEffect<null> {
  return {
    name: "memo.selectAll",
    data: null
  };
}
export function selectAllMemoExecute(store: Store) {
  const { memos } = store.memoState;
  memos.forEach(memo => (memo.ui.active = true));
}
