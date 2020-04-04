import { SIZE_START_X, SIZE_START_Y, SIZE_START_ADD } from "../Layout";
import { Store } from "../Store";
import { Table } from "../store/Table";
import { Memo } from "../store/Memo";

export function nextZIndex(tables: Table[], memos: Memo[]): number {
  let max = 1;
  tables.forEach((table: Table) => {
    if (max < table.ui.zIndex) {
      max = table.ui.zIndex;
    }
  });
  memos.forEach((memo: Memo) => {
    if (max < memo.ui.zIndex) {
      max = memo.ui.zIndex;
    }
  });
  return max + 1;
}

export function nextPoint(
  store: Store,
  tables: Table[],
  memos: Memo[]
): { top: number; left: number } {
  const point = {
    top: SIZE_START_Y + store.canvasState.scrollTop,
    left: SIZE_START_X + store.canvasState.scrollLeft,
  };
  let isPosition = true;
  while (isPosition) {
    isPosition = false;
    for (const table of tables) {
      if (table.ui.top === point.top && table.ui.left === point.left) {
        isPosition = true;
        point.top += SIZE_START_ADD;
        point.left += SIZE_START_ADD;
        break;
      }
    }
    for (const memo of memos) {
      if (memo.ui.top === point.top && memo.ui.left === point.left) {
        isPosition = true;
        point.top += SIZE_START_ADD;
        point.left += SIZE_START_ADD;
        break;
      }
    }
  }
  return point;
}
