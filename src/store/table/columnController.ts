import {State, Table, Column} from '../table';
import {Commit as RelationshipCommit} from '@/store/relationship';
import {log} from '@/ts/util';
import ColumnModel from '@/models/ColumnModel';
import {FocusType} from '@/models/TableFocusModel';
import {tableFocusStart} from './tableController';
import StoreManagement from '@/store/StoreManagement';
import {relationshipSort} from '@/store/relationship/relationshipHelper';

export function columnAdd(state: State, payload: {table: Table, store: StoreManagement}) {
  log.debug('columnController columnAdd');
  const {table, store} = payload;
  table.columns.push(new ColumnModel(store));
  relationshipSort(state.tables, store.relationshipStore.state.relationships);
}

export function columnAddAll(state: State, store: StoreManagement) {
  log.debug('columnController columnAddAll');
  state.tables.forEach((table: Table) => {
    if (table.ui.active) {
      if (!state.tableFocus) {
        tableFocusStart(state, {table, store});
      }
      table.columns.push(new ColumnModel(store));
    }
  });
  relationshipSort(state.tables, store.relationshipStore.state.relationships);
}

export function columnFocus(state: State, payload: { focusType: FocusType, column: Column, event: MouseEvent }) {
  log.debug('columnController columnFocus');
  const {focusType, column, event} = payload;
  if (state.tableFocus) {
    state.tableFocus.focus(focusType, column);
    state.tableFocus.selected(event);
  }
}

export function columnRemove(state: State, payload: { table: Table, column: Column, store: StoreManagement }) {
  log.debug('columnController columnRemove');
  const {table, column, store} = payload;
  const index = table.columns.indexOf(column);
  table.columns.splice(index, 1);
  store.relationshipStore.commit(RelationshipCommit.relationshipRemove, {
    table,
    column,
    store,
  });
  relationshipSort(state.tables, store.relationshipStore.state.relationships);
}

export function columnRemoveAll(state: State, store: StoreManagement) {
  log.debug('columnController columnRemoveAll');
  if (state.tableFocus) {
    const columns = state.tableFocus.columnSelectAll();
    columns.forEach((column) => {
      columnRemove(state, {
        table: state.tableFocus as Table,
        column,
        store,
      });
    });
  }
}

export function columnPrimaryKey(state: State) {
  log.debug('columnController columnPrimaryKey');
  if (state.tableFocus) {
    state.tableFocus.primaryKey();
  }
}

export function columnCopy(state: State) {
  log.debug('columnController columnCopy');
  if (state.tableFocus) {
    state.copyColumns = state.tableFocus.columnSelectAll();
  } else {
    state.copyColumns = [];
  }
}

export function columnPaste(state: State, store: StoreManagement) {
  log.debug('columnController columnPaste');
  if (state.copyColumns.length !== 0) {
    state.tables.forEach((table) => {
      if (table.ui.active) {
        state.copyColumns.forEach((column) => {
          table.columns.push(new ColumnModel(store, {
            copy: {
              table,
              column,
            },
          }));
        });
      }
    });
  }
}
