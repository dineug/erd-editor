import { Table, TableUI } from '@@types/engine/store/table.state';
import { Memo, MemoUI } from '@@types/engine/store/memo.state';
import { Point } from '@@types/engine/store/relationship.helper';
import { Store } from '@@types/engine/store';
import { SIZE_START_X, SIZE_START_Y, SIZE_START_ADD } from '@/core/layout';

const zIndexMap = (data: Table | Memo) => data.ui.zIndex;

export const nextZIndex = (tables: Table[], memos: Memo[]) =>
  Math.max(1, ...tables.map(zIndexMap), ...memos.map(zIndexMap)) + 1;

const isDuplicatePosition = (ui: TableUI | MemoUI, point: Point) =>
  ui.top === point.y && ui.left === point.x;

export function nextPoint({
  canvasState: { scrollLeft, scrollTop },
  tableState: { tables },
  memoState: { memos },
}: Store): Point {
  const point: Point = {
    x: SIZE_START_X - scrollLeft,
    y: SIZE_START_Y - scrollTop,
  };

  let isPosition = false;
  do {
    isPosition = false;

    for (const table of tables) {
      if (isDuplicatePosition(table.ui, point)) {
        point.x += SIZE_START_ADD;
        point.y += SIZE_START_ADD;
        isPosition = true;
        break;
      }
    }

    for (const memo of memos) {
      if (isDuplicatePosition(memo.ui, point)) {
        point.x += SIZE_START_ADD;
        point.y += SIZE_START_ADD;
        isPosition = true;
        break;
      }
    }
  } while (isPosition);

  return point;
}
