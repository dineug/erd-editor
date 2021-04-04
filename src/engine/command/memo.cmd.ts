import { MemoCommandMap } from '@@types/engine/command/memo.cmd';
import { State } from '@@types/engine/store';
import {
  AddMemo,
  MoveMemo,
  RemoveMemo,
  SelectMemo,
  ChangeMemoValue,
  ResizeMemo,
  DragSelectMemo,
} from '@@types/engine/command/memo.cmd';
import { Memo } from '@@types/engine/store/memo.state';
import { ExecuteCommand } from '@/internal-types/command';
import { SIZE_MEMO_PADDING } from '@/core/layout';
import { getData } from '@/core/helper';
import { MemoModel } from '@/engine/store/models/memo.model';

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;

export function executeAddMemo({ memoState: { memos } }: State, data: AddMemo) {
  memos.push(new MemoModel({ addMemo: data }));
}

export function executeMoveMemo(
  { tableState: { tables }, memoState: { memos } }: State,
  data: MoveMemo
) {
  data.tableIds.forEach(tableId => {
    const table = getData(tables, tableId);
    if (!table) return;

    table.ui.left += data.movementX;
    table.ui.top += data.movementY;
  });

  data.memoIds.forEach(memoId => {
    const memo = getData(memos, memoId);
    if (!memo) return;

    memo.ui.left += data.movementX;
    memo.ui.top += data.movementY;
  });
}

export function executeRemoveMemo(
  { memoState: { memos } }: State,
  { memoIds }: RemoveMemo
) {
  for (let i = 0; i < memos.length; i++) {
    const id = memos[i].id;

    if (memoIds.includes(id)) {
      memos.splice(i, 1);
      i--;
    }
  }
}

export function executeSelectMemo(
  { memoState: { memos } }: State,
  data: SelectMemo
) {
  const targetMemo = getData(memos, data.memoId);
  if (!targetMemo) return;

  targetMemo.ui.zIndex = data.zIndex;
  data.ctrlKey
    ? (targetMemo.ui.active = true)
    : memos.forEach(memo => (memo.ui.active = memo.id === data.memoId));
}

export function executeSelectEndMemo({ memoState: { memos } }: State) {
  memos.forEach(memo => (memo.ui.active = false));
}

export function executeSelectAllMemo({ memoState: { memos } }: State) {
  memos.forEach(memo => (memo.ui.active = true));
}

export function executeChangeMemoValue(
  { memoState: { memos } }: State,
  data: ChangeMemoValue
) {
  const memo = getData(memos, data.memoId);
  if (!memo) return;

  memo.value = data.value;
}

export function executeResizeMemo(
  { memoState: { memos } }: State,
  data: ResizeMemo
) {
  const memo = getData(memos, data.memoId);
  if (!memo) return;

  memo.ui.top = data.top;
  memo.ui.left = data.left;
  memo.ui.width = data.width;
  memo.ui.height = data.height;
}

export function executeDragSelectMemo(
  { memoState: { memos } }: State,
  data: DragSelectMemo
) {
  const { min, max } = data;

  memos.forEach(memo => {
    const centerX = memo.ui.left + memo.ui.width / 2 + MEMO_PADDING;
    const centerY = memo.ui.top + memo.ui.height / 2 + MEMO_PADDING;

    memo.ui.active =
      min.x <= centerX &&
      max.x >= centerX &&
      min.y <= centerY &&
      max.y >= centerY;
  });
}

export function executeLoadMemo({ memoState: { memos } }: State, data: Memo) {
  memos.push(new MemoModel({ loadMemo: data }));
}

export const executeMemoCommandMap: Record<
  keyof MemoCommandMap,
  ExecuteCommand
> = {
  'memo.add': executeAddMemo,
  'memo.move': executeMoveMemo,
  'memo.remove': executeRemoveMemo,
  'memo.select': executeSelectMemo,
  'memo.selectEnd': executeSelectEndMemo,
  'memo.selectAll': executeSelectAllMemo,
  'memo.changeValue': executeChangeMemoValue,
  'memo.resize': executeResizeMemo,
  'memo.dragSelect': executeDragSelectMemo,
  'memo.load': executeLoadMemo,
};
