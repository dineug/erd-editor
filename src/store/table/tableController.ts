import {State, Table} from '../table';
import TableModel from '@/models/TableModel';
import {zIndexNext} from './tableHandler';
import {log} from '@/ts/util';
import TableFocusModel, {FocusType} from '@/models/TableFocusModel';

export function tableAdd(state: State) {
  log.debug('tableController tableAdd');
  tableSelectAllEnd(state);
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

export function tableSelect(state: State, payload: { table: Table, event: MouseEvent }) {
  log.debug('tableController tableSelect');
  const {table, event} = payload;
  table.ui.zIndex = zIndexNext(state.tables);
  if (event.ctrlKey) {
    table.ui.active = true;
  } else {
    state.tables.forEach((value: Table) => value.ui.active = value.id === table.id);
  }
  tableFocusStart(state, table);
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
