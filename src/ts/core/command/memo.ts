import { CommandEffect } from "../Command";
import {
  SIZE_MEMO_WIDTH,
  SIZE_MEMO_HEIGHT,
  SIZE_MEMO_PADDING,
} from "../Layout";
import { Store } from "../Store";
import { getData, uuid, Point } from "../Helper";
import { Logger } from "../Logger";
import { MemoUI } from "../store/Memo";
import { MemoModel } from "../model/MemoModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";
import { selectEndTableExecute } from "./table";

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;

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
        height: SIZE_MEMO_HEIGHT,
      },
    },
  };
}
export function addMemoExecute(store: Store, data: AddMemo) {
  Logger.debug("addMemoExecute");
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
        : [memoId],
    },
  };
}
export function moveMemoExecute(store: Store, data: MoveMemo) {
  Logger.debug("moveMemoExecute");
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
  // TODO: relationship sort
}

export interface RemoveMemo {
  tableIds: string[];
  memoIds: string[];
}
export function removeMemo(
  store: Store,
  memoId?: string
): CommandEffect<RemoveMemo> {
  const { tableState, memoState } = store;
  return {
    name: "memo.remove",
    data: {
      tableIds: memoId
        ? []
        : tableState.tables
            .filter(table => table.ui.active)
            .map(table => table.id),
      memoIds: memoId
        ? [memoId]
        : memoState.memos.filter(memo => memo.ui.active).map(memo => memo.id),
    },
  };
}
export function removeMemoExecute(store: Store, data: RemoveMemo) {
  Logger.debug("removeMemoExecute");
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
      zIndex: nextZIndex(tableState.tables, memoState.memos),
    },
  };
}
export function selectMemoExecute(store: Store, data: SelectMemo) {
  Logger.debug("selectMemoExecute");
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
    data: null,
  };
}
export function selectEndMemoExecute(store: Store) {
  Logger.debug("selectEndMemoExecute");
  const { memos } = store.memoState;
  memos.forEach(memo => (memo.ui.active = false));
}

export function selectAllMemo(): CommandEffect<null> {
  return {
    name: "memo.selectAll",
    data: null,
  };
}
export function selectAllMemoExecute(store: Store) {
  Logger.debug("selectAllMemoExecute");
  const { memos } = store.memoState;
  memos.forEach(memo => (memo.ui.active = true));
}

export interface ChangeMemoValue {
  memoId: string;
  value: string;
}
export function changeMemoValue(
  memoId: string,
  value: string
): CommandEffect<ChangeMemoValue> {
  return {
    name: "memo.changeValue",
    data: {
      memoId,
      value,
    },
  };
}
export function changeMemoValueExecute(store: Store, data: ChangeMemoValue) {
  Logger.debug("changeMemoValueExecute");
  const { memos } = store.memoState;
  const memo = getData(memos, data.memoId);
  if (memo) {
    memo.value = data.value;
  }
}

export interface ResizeMemo {
  memoId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}
export function resizeMemo(
  memoId: string,
  top: number,
  left: number,
  width: number,
  height: number
): CommandEffect<ResizeMemo> {
  return {
    name: "memo.resize",
    data: {
      memoId,
      top,
      left,
      width,
      height,
    },
  };
}
export function resizeMemoExecute(store: Store, data: ResizeMemo) {
  Logger.debug("resizeMemoExecute");
  const { memos } = store.memoState;
  const memo = getData(memos, data.memoId);
  if (memo) {
    memo.ui.top = data.top;
    memo.ui.left = data.left;
    memo.ui.width = data.width;
    memo.ui.height = data.height;
  }
}

export interface DragSelectMemo {
  min: Point;
  max: Point;
}
export function dragSelectMemo(
  min: Point,
  max: Point
): CommandEffect<DragSelectMemo> {
  return {
    name: "memo.dragSelect",
    data: {
      min,
      max,
    },
  };
}
export function dragSelectMemoExecute(store: Store, data: DragSelectMemo) {
  Logger.debug("dragSelectMemoExecute");
  const { memos } = store.memoState;
  const { min, max } = data;
  memos.forEach(memo => {
    const centerX = memo.ui.left + memo.ui.width / 2 + MEMO_PADDING;
    const centerY = memo.ui.top + memo.ui.height / 2 + MEMO_PADDING;
    memo.ui.active =
      min.x <= centerX &&
      centerX <= max.x &&
      min.y <= centerY &&
      centerY <= max.y;
  });
}
