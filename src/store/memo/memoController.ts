import {State, Memo} from '../memo';
import tableStore, {Commit, Table} from '@/store/table';
import MemoModel from '@/models/MemoModel';
import {log} from '@/ts/util';
import {zIndexNext} from '@/store/table/tableHandler';

export function memoAdd(state: State) {
  log.debug('memoController memoAdd');
  memoSelectAllEnd(state);
  tableStore.commit(Commit.tableSelectAllEnd);
  state.memos.push(new MemoModel());
}

export function memoMove(state: State, payload: { memo: Memo, x: number, y: number, event: MouseEvent }) {
  log.debug('memoController memoMove');
  const {memo, x, y, event} = payload;
  if (event.ctrlKey) {
    state.memos.forEach((value: Memo) => {
      if (value.ui.active) {
        value.ui.top += y;
        value.ui.left += x;
      }
    });
    tableStore.state.tables.forEach((value: Table) => {
      if (value.ui.active) {
        value.ui.top += y;
        value.ui.left += x;
      }
    });
  } else {
    memo.ui.top += y;
    memo.ui.left += x;
  }
}

export function memoRemove(state: State, memo: Memo) {
  log.debug('memoController memoRemove');
  const index = state.memos.indexOf(memo);
  state.memos.splice(index, 1);
}

export function memoRemoveAll(state: State) {
  log.debug('memoController memoRemoveAll');
  for (let i = 0; i < state.memos.length; i++) {
    if (state.memos[i].ui.active) {
      state.memos.splice(i, 1);
      i--;
    }
  }
}

export function memoSelect(state: State, payload: { memo: Memo, event: MouseEvent }) {
  log.debug('memoController memoSelect');
  const {memo, event} = payload;
  memo.ui.zIndex = zIndexNext(tableStore.state.tables, state.memos);
  if (event.ctrlKey) {
    memo.ui.active = true;
  } else {
    state.memos.forEach((value: Memo) => value.ui.active = value.id === memo.id);
    tableStore.commit(Commit.tableSelectAllEnd);
  }
}

export function memoSelectAll(state: State) {
  log.debug('memoController memoSelectAll');
  state.memos.forEach((memo: Memo) => memo.ui.active = true);
}

export function memoSelectAllEnd(state: State) {
  log.debug('memoController memoSelectAllEnd');
  state.memos.forEach((memo: Memo) => memo.ui.active = false);
}
