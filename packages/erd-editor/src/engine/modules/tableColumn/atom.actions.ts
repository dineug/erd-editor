import { createAction } from '@dineug/r-html';

import { query } from '@/utils/collection/query';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addColumnAction = createAction<
  ActionMap[typeof ActionType.addColumn]
>(ActionType.addColumn);

const addColumn: ReducerType<typeof ActionType.addColumn> = (
  { collections },
  { id, tableId }
) => {
  const tableCollection = query(collections).collection('tableEntities');

  let table = tableCollection.selectById(tableId);
  if (!table) {
    table = createTable({ id: tableId });
    tableCollection.addOne(table);
  }

  if (!table.columnIds.includes(id)) {
    table.columnIds.push(id);
  }

  const column = createColumn({ id });
  query(collections).collection('tableColumnEntities').addOne(column);
};

export const tableColumnReducers = {
  [ActionType.addColumn]: addColumn,
};

export const actions = {
  addColumnAction,
};
