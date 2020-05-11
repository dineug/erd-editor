import { Command } from "../Command";
import {
  SIZE_MEMO_WIDTH,
  SIZE_MEMO_HEIGHT,
  SIZE_MEMO_PADDING,
} from "../Layout";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { Point, relationshipSort } from "../helper/RelationshipHelper";
import { Logger } from "../Logger";
import { MemoUI, Memo } from "../store/Memo";
import { MemoModel } from "../model/MemoModel";
import { nextPoint, nextZIndex } from "../helper/TableHelper";
import { executeSelectEndTable } from "./table";

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;

export interface AddMemo {
  id: string;
  ui: MemoUI;
}
export function addMemo(store: Store): Command<"memo.add"> {
  const { tableState, memoState } = store;
  const point = nextPoint(store, tableState.tables, memoState.memos);
  return {
    type: "memo.add",
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
export function executeAddMemo(store: Store, data: AddMemo) {
  Logger.debug("executeAddMemo");
  const { memos } = store.memoState;
  executeSelectEndTable(store);
  executeSelectEndMemo(store);
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
): Command<"memo.move"> {
  const { tableState, memoState } = store;
  return {
    type: "memo.move",
    data: {
      movementX,
      movementY,
      tableIds: ctrlKey
        ? tableState.tables
            .filter((table) => table.ui.active)
            .map((table) => table.id)
        : [],
      memoIds: ctrlKey
        ? memoState.memos
            .filter((memo) => memo.ui.active)
            .map((memo) => memo.id)
        : [memoId],
    },
  };
}
export function executeMoveMemo(store: Store, data: MoveMemo) {
  Logger.debug("executeMoveMemo");
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
  if (data.tableIds.length !== 0) {
    relationshipSort(tables, relationships);
  }
}

export interface RemoveMemo {
  memoIds: string[];
}
export function removeMemo(
  store: Store,
  memoId?: string
): Command<"memo.remove"> {
  const { memos } = store.memoState;
  return {
    type: "memo.remove",
    data: {
      memoIds: memoId
        ? [memoId]
        : memos.filter((memo) => memo.ui.active).map((memo) => memo.id),
    },
  };
}
export function executeRemoveMemo(store: Store, data: RemoveMemo) {
  Logger.debug("executeRemoveMemo");
  const { memos } = store.memoState;
  for (let i = 0; i < memos.length; i++) {
    const id = memos[i].id;
    if (data.memoIds.some((memoId) => memoId === id)) {
      memos.splice(i, 1);
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
): Command<"memo.select"> {
  const { tableState, memoState } = store;
  return {
    type: "memo.select",
    data: {
      ctrlKey,
      memoId,
      zIndex: nextZIndex(tableState.tables, memoState.memos),
    },
  };
}
export function executeSelectMemo(store: Store, data: SelectMemo) {
  Logger.debug("executeSelectMemo");
  const { memos } = store.memoState;
  const targetMemo = getData(memos, data.memoId);
  if (targetMemo) {
    targetMemo.ui.zIndex = data.zIndex;
    if (data.ctrlKey) {
      targetMemo.ui.active = true;
    } else {
      memos.forEach((memo) => {
        memo.ui.active = memo.id === data.memoId;
      });
      executeSelectEndTable(store);
    }
  }
}

export function selectEndMemo(): Command<"memo.selectEnd"> {
  return {
    type: "memo.selectEnd",
    data: null,
  };
}
export function executeSelectEndMemo(store: Store) {
  Logger.debug("executeSelectEndMemo");
  const { memos } = store.memoState;
  memos.forEach((memo) => (memo.ui.active = false));
}

export function selectAllMemo(): Command<"memo.selectAll"> {
  return {
    type: "memo.selectAll",
    data: null,
  };
}
export function executeSelectAllMemo(store: Store) {
  Logger.debug("executeSelectAllMemo");
  const { memos } = store.memoState;
  memos.forEach((memo) => (memo.ui.active = true));
}

export interface ChangeMemoValue {
  memoId: string;
  value: string;
}
export function changeMemoValue(
  memoId: string,
  value: string
): Command<"memo.changeValue"> {
  return {
    type: "memo.changeValue",
    data: {
      memoId,
      value,
    },
  };
}
export function executeChangeMemoValue(store: Store, data: ChangeMemoValue) {
  Logger.debug("executeChangeMemoValue");
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
): Command<"memo.resize"> {
  return {
    type: "memo.resize",
    data: {
      memoId,
      top,
      left,
      width,
      height,
    },
  };
}
export function executeResizeMemo(store: Store, data: ResizeMemo) {
  Logger.debug("executeResizeMemo");
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
): Command<"memo.dragSelect"> {
  return {
    type: "memo.dragSelect",
    data: {
      min,
      max,
    },
  };
}
export function executeDragSelectMemo(store: Store, data: DragSelectMemo) {
  Logger.debug("executeDragSelectMemo");
  const { memos } = store.memoState;
  const { min, max } = data;
  memos.forEach((memo) => {
    const centerX = memo.ui.left + memo.ui.width / 2 + MEMO_PADDING;
    const centerY = memo.ui.top + memo.ui.height / 2 + MEMO_PADDING;
    memo.ui.active =
      min.x <= centerX &&
      max.x >= centerX &&
      min.y <= centerY &&
      max.y >= centerY;
  });
}

export function loadMemo(memo: Memo): Command<"memo.load"> {
  return {
    type: "memo.load",
    data: memo,
  };
}
export function executeLoadMemo(store: Store, data: Memo) {
  Logger.debug("executeLoadMemo");
  const { memos } = store.memoState;
  memos.push(new MemoModel({ loadMemo: data }));
}
