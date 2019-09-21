import {SIZE_MEMO_PADDING} from '@/ts/layout';
import {State, Memo} from '../memo';
import {Commit, Table} from '@/store/table';
import MemoModel from '@/models/MemoModel';
import {log} from '@/ts/util';
import {zIndexNext} from '@/store/table/tableHandler';
import StoreManagement from '@/store/StoreManagement';
import {Bus} from '@/ts/EventBus';

const MEMO_PADDING = SIZE_MEMO_PADDING * 2;
const MEMO_HEADER = 17 + SIZE_MEMO_PADDING;

export function memoAdd(state: State, store: StoreManagement) {
  log.debug('memoController memoAdd');
  memoSelectAllEnd(state);
  store.tableStore.commit(Commit.tableSelectAllEnd);
  state.memos.push(new MemoModel(store));
  store.eventBus.$emit(Bus.ERD.change);
}

export function memoMove(
  state: State,
  payload: {
    memo: Memo,
    x: number, y: number,
    event: MouseEvent,
    store: StoreManagement,
  }) {
  log.debug('memoController memoMove');
  const {memo, x, y, event, store} = payload;
  if (event.ctrlKey) {
    state.memos.forEach((value: Memo) => {
      if (value.ui.active) {
        value.ui.top += y;
        value.ui.left += x;
      }
    });
    store.tableStore.state.tables.forEach((value: Table) => {
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

export function memoRemove(state: State, payload: { memo: Memo, store: StoreManagement }) {
  log.debug('memoController memoRemove');
  const {memo, store} = payload;
  const index = state.memos.indexOf(memo);
  state.memos.splice(index, 1);
  store.eventBus.$emit(Bus.ERD.change);
}

export function memoRemoveAll(state: State, store: StoreManagement) {
  log.debug('memoController memoRemoveAll');
  for (let i = 0; i < state.memos.length; i++) {
    if (state.memos[i].ui.active) {
      state.memos.splice(i, 1);
      i--;
    }
  }
  store.eventBus.$emit(Bus.ERD.change);
}

export function memoSelect(state: State, payload: { memo: Memo, event: MouseEvent, store: StoreManagement }) {
  log.debug('memoController memoSelect');
  const {memo, event, store} = payload;
  memo.ui.zIndex = zIndexNext(store.tableStore.state.tables, state.memos);
  if (event.ctrlKey) {
    memo.ui.active = true;
  } else {
    state.memos.forEach((value: Memo) => value.ui.active = value.id === memo.id);
    store.tableStore.commit(Commit.tableSelectAllEnd);
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

export function memoMultipleSelect(
  state: State,
  payload: {
    min: { x: number, y: number },
    max: { x: number, y: number },
  }) {
  log.debug('memoController memoSelectAllEnd');
  const {min, max} = payload;
  state.memos.forEach((memo: Memo) => {
    const centerX = memo.ui.left + (memo.ui.width / 2) + MEMO_PADDING;
    const centerY = memo.ui.top + (memo.ui.height / 2) + MEMO_PADDING + MEMO_HEADER;
    memo.ui.active = !!(min.x <= centerX && centerX <= max.x
      && min.y <= centerY && centerY <= max.y);
  });
}
