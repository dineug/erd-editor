import {State, Table, Column} from '../table';
import {log} from '@/ts/util';
import ColumnModel from '@/models/ColumnModel';
import {FocusType} from '@/models/TableFocusModel';
import {tableFocusStart} from './tableController';
import eventBus, {Bus} from '@/ts/EventBus';

export function columnAdd(state: State, table: Table) {
  log.debug('columnController columnAdd');
  table.columns.push(new ColumnModel());
  eventBus.$emit(Bus.ERD.change);
}

export function columnAddAll(state: State) {
  log.debug('columnController columnAddAll');
  state.tables.forEach((table: Table) => {
    if (table.ui.active) {
      if (!state.tableFocus) {
        tableFocusStart(state, table);
      }
      table.columns.push(new ColumnModel());
    }
  });
  eventBus.$emit(Bus.ERD.change);
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
  eventBus.$emit(Bus.ERD.change);
}

export function columnRemoveAll(state: State) {
  log.debug('columnController columnRemoveAll');
  if (state.tableFocus) {
    state.tableFocus.columnRemove();
    eventBus.$emit(Bus.ERD.change);
  }
}
