import {State, RelationshipType} from '../relationship';
import {Commit as TableCommit, Table} from '@/store/table';
import {Commit as MemoCommit} from '@/store/memo';
import {log} from '@/ts/util';
import StoreManagement from '@/store/StoreManagement';
import RelationshipModel from '@/models/RelationshipModel';
import {createColumns} from './relationshipHandler';

export function relationshipAdd(state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('relationshipController relationshipAdd');
  const {table, store} = payload;
  if (state.edit && state.edit.start) {
    state.edit.end = {
      tableId: table.id,
      x: table.ui.left,
      y: table.ui.top,
      columnIds: createColumns(store, state.edit.start.tableId, table),
    };
    state.relationships.push(state.edit);
  }
}

export function relationshipEditStart(
  state: State,
  payload: {
    relationshipType: RelationshipType,
    store: StoreManagement,
  }) {
  log.debug('relationshipController relationshipEditStart');
  const {relationshipType, store} = payload;
  if (state.edit && state.edit.relationshipType === relationshipType) {
    state.edit = null;
  } else {
    store.tableStore.commit(TableCommit.tableSelectAllEnd);
    store.memoStore.commit(MemoCommit.memoSelectAllEnd);
    state.edit = new RelationshipModel(store, relationshipType);
  }
}

export function relationshipEditEnd(state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('relationshipController relationshipEditEnd');
  relationshipAdd(state, payload);
  state.edit = null;
}
