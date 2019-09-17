import {State, Table} from '../table';
import memoStore, {Commit, Memo} from '@/store/memo';
import TableModel from '@/models/TableModel';
import {zIndexNext} from './tableHandler';
import {log} from '@/ts/util';
import TableFocusModel, {FocusType} from '@/models/TableFocusModel';

export function tableAdd(state: State) {
  log.debug('tableController tableAdd');
  tableSelectAllEnd(state);
  memoStore.commit(Commit.memoSelectAllEnd);
  state.tables.push(new TableModel());
}

export function tableMove(state: State, payload: { table: Table, x: number, y: number, event: MouseEvent }) {
  log.debug('tableController tableMove');
  const {table, x, y, event} = payload;
  if (event.ctrlKey) {
    state.tables.forEach((value: Table) => {
      if (value.ui.active) {
        value.ui.top += y;
        value.ui.left += x;
      }
    });
    memoStore.state.memos.forEach((value: Memo) => {
      if (value.ui.active) {
        value.ui.top += y;
        value.ui.left += x;
      }
    });
  } else {
    table.ui.top += y;
    table.ui.left += x;
  }
}

export function tableRemove(state: State, table: Table) {
  log.debug('tableController tableRemove');
  const index = state.tables.indexOf(table);
  state.tables.splice(index, 1);
}

export function tableRemoveAll(state: State) {
  log.debug('tableController tableRemoveAll');
  for (let i = 0; i < state.tables.length; i++) {
    if (state.tables[i].ui.active) {
      state.tables.splice(i, 1);
      i--;
    }
  }
}

export function tableSelect(state: State, payload: { table: Table, event: MouseEvent }) {
  log.debug('tableController tableSelect');
  const {table, event} = payload;
  table.ui.zIndex = zIndexNext(state.tables, memoStore.state.memos);
  if (event.ctrlKey) {
    table.ui.active = true;
  } else {
    state.tables.forEach((value: Table) => value.ui.active = value.id === table.id);
    memoStore.commit(Commit.memoSelectAllEnd);
  }
  tableFocusStart(state, table);
}

export function tableSelectAll(state: State) {
  log.debug('tableController tableSelectAll');
  state.tables.forEach((table: Table) => table.ui.active = true);
}

export function tableSelectAllEnd(state: State) {
  log.debug('tableController tableSelectAllEnd');
  state.tables.forEach((table: Table) => table.ui.active = false);
  tableFocusEnd(state);
}

export function tableFocusStart(state: State, table: Table) {
  log.debug('tableController tableFocusStart');
  if (!state.tableFocus || state.tableFocus.id !== table.id) {
    state.tableFocus = new TableFocusModel(table);
  }
}

export function tableFocusEnd(state: State) {
  log.debug('tableController tableFocusEnd');
  state.tableFocus = null;
}

export function tableFocus(state: State, focusType: FocusType) {
  log.debug('tableController tableFocus');
  if (state.tableFocus) {
    state.tableFocus.focus(focusType);
  }
}

export function tableFocusMove(state: State, event: KeyboardEvent) {
  log.debug('tableController tableFocusMove');
  if (state.tableFocus) {
    state.tableFocus.move(event);
  }
}
