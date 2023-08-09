import { createAction } from '@dineug/r-html';

import { query } from '@/utils/collection/query';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addColumnAction = createAction<
  ActionMap[typeof ActionType.addColumn]
>(ActionType.addColumn);

const addColumn: ReducerType<typeof ActionType.addColumn> = (
  state,
  payload,
  ctx
) => {
  const tableCollection = query(state.collections).collection('tableEntities');

  let table = tableCollection.selectById(payload.tableId);
  if (!table) {
    table = createTable();
    table.id = payload.tableId;
    tableCollection.addOne(table);
  }

  if (!table.columnIds.includes(payload.id)) {
    table.columnIds.push(payload.id);
  }

  const column = createColumn();
  column.id = payload.id;
  query(state.collections).collection('tableColumnEntities').addOne(column);
};

export const tableColumnReducers = {
  [ActionType.addColumn]: addColumn,
};

export const actions = {
  addColumnAction,
};
