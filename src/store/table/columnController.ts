import {State, Table, Column} from '../table';
import {log} from '@/ts/util';
import ColumnModel from '@/models/ColumnModel';
import {FocusType} from '@/models/TableFocusModel';

export function columnAdd(state: State, table: Table) {
  log.debug('columnController columnAdd');
  table.columns.push(new ColumnModel());
}

export function columnAddAll(state: State) {
  log.debug('columnController columnAddAll');
  state.tables.forEach((table: Table) => {
    if (table.ui.active) {
      table.columns.push(new ColumnModel());
    }
  });
}

export function columnFocus(state: State, payload: { focusType: FocusType, column: Column }) {
  log.debug('columnController columnFocus');
  const {focusType, column} = payload;
  if (state.tableFocus) {
    state.tableFocus.focus(focusType, column);
  }
}

export function columnRemove(state: State, payload: { table: Table, column: Column }) {
  log.debug('columnController columnRemove');
  const {table, column} = payload;
  const index = table.columns.indexOf(column);
  table.columns.splice(index, 1);
}

export function columnRemoveAll(state: State) {
  log.debug('columnController columnRemoveAll');
  if (state.tableFocus) {
    state.tableFocus.columnRemove();
  }
}
