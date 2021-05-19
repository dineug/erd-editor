import { BatchCommand } from '@@types/engine/command';
import {
  AddMemo,
  RemoveMemo,
  ChangeMemoValue,
} from '@@types/engine/command/memo.cmd';
import { Memo } from '@@types/engine/store/memo.state';
import { IStore } from '@/internal-types/store';
import {
  removeMemo,
  loadMemo,
  changeMemoValue,
} from '@/engine/command/memo.cmd.helper';
import { getData, cloneDeep } from '@/core/helper';

export function executeAddMemo(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: AddMemo
) {
  batchUndoCommand.push(removeMemo(store, data.id));
}

export function executeRemoveMemo(
  { memoState: { memos } }: IStore,
  batchUndoCommand: BatchCommand,
  { memoIds }: RemoveMemo
) {
  const targetMemos = memoIds
    .map(memoId => getData(memos, memoId))
    .filter(memo => !!memo) as Memo[];
  if (!targetMemos.length) return;

  batchUndoCommand.push(...targetMemos.map(memo => loadMemo(cloneDeep(memo))));
}

export function executeChangeMemoValue(
  { memoState: { memos } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeMemoValue
) {
  const memo = getData(memos, data.memoId);
  if (!memo) return;

  batchUndoCommand.push(changeMemoValue(memo.id, memo.value));
}

export const executeMemoCommandMap = {
  'memo.add': executeAddMemo,
  'memo.remove': executeRemoveMemo,
  'memo.changeValue': executeChangeMemoValue,
};
