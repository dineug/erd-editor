import {State, RelationshipType} from '../relationship';
import {Commit as TableCommit, Table} from '@/store/table';
import {Commit as MemoCommit} from '@/store/memo';
import {log} from '@/ts/util';
import StoreManagement from '@/store/StoreManagement';
import RelationshipDrawModal from '@/models/RelationshipDrawModal';
import {createPrimaryKey, columnIds, createColumns} from './relationshipHandler';

export function relationshipAdd(state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('relationshipController relationshipAdd');
  const {table, store} = payload;
  if (state.draw && state.draw.start) {
    // state.draw.end = {
    //   tableId: table.id,
    //   x: table.ui.left,
    //   y: table.ui.top,
    //   columnIds: createColumns(store, state.draw.start.tableId, table),
    // };
    // state.relationships.push(state.draw);
  }
}

export function relationshipDraw(state: State, payload: { x: number, y: number }) {
  log.debug('relationshipController relationshipDraw');
  const {x, y} = payload;
  if (state.draw) {
    state.draw.end.x = x;
    state.draw.end.y = y;
  }
}

export function relationshipDrawStart(
  state: State,
  payload: {
    relationshipType: RelationshipType,
    store: StoreManagement,
  }) {
  log.debug('relationshipController relationshipEditStart');
  const {relationshipType, store} = payload;
  if (state.draw && state.draw.relationshipType === relationshipType) {
    state.draw = null;
  } else {
    store.tableStore.commit(TableCommit.tableSelectAllEnd);
    store.memoStore.commit(MemoCommit.memoSelectAllEnd);
    state.draw = new RelationshipDrawModal(relationshipType);
  }
}

export function relationshipDrawStartAdd(state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('relationshipController relationshipDrawStartAdd');
  const {table, store} = payload;
  if (state.draw) {
    createPrimaryKey(store, table);
    state.draw.start = {
      table,
      x: table.ui.left,
      y: table.ui.top,
    };
  }
}


export function relationshipDrawEnd(state: State, payload: { table: Table, store: StoreManagement }) {
  log.debug('relationshipController relationshipEditEnd');
  if (state.draw && state.draw.start) {
    relationshipAdd(state, payload);
  }
  state.draw = null;
}
