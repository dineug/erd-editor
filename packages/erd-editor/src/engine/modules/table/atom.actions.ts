import { createAction } from '@dineug/r-html';

import { query } from '@/utils/collection/query';
import { createTable } from '@/utils/collection/table.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addTableAction = createAction<
  ActionMap[typeof ActionType.addTable]
>(ActionType.addTable);

const addTable: ReducerType<typeof ActionType.addTable> = (
  state,
  payload,
  ctx
) => {
  if (!state.doc.tableIds.includes(payload.id)) {
    state.doc.tableIds.push(payload.id);
  }

  const table = createTable();
  table.id = payload.id;
  Object.assign(table.ui, payload.ui);
  query(state.collections).collection('tableEntities').addOne(table);
};

export const tableReducers = {
  [ActionType.addTable]: addTable,
};

export const actions = {
  addTableAction,
};
