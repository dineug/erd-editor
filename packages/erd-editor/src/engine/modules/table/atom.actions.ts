import { createAction } from '@dineug/r-html';

import { query } from '@/utils/collection/query';
import { createTable } from '@/utils/collection/table.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addTableAction = createAction<
  ActionMap[typeof ActionType.addTable]
>(ActionType.addTable);

const addTable: ReducerType<typeof ActionType.addTable> = (
  { doc, collections },
  { id, ui }
) => {
  if (!doc.tableIds.includes(id)) {
    doc.tableIds.push(id);
  }

  const table = createTable();
  table.id = id;
  Object.assign(table.ui, ui);
  query(collections).collection('tableEntities').addOne(table);
};

export const moveTableAction = createAction<
  ActionMap[typeof ActionType.moveTable]
>(ActionType.moveTable);

const moveTable: ReducerType<typeof ActionType.moveTable> = (
  { collections },
  { tableIds, movementX, movementY }
) => {
  query(collections)
    .collection('tableEntities')
    .updateMany(tableIds, table => {
      table.ui.x += movementX;
      table.ui.y += movementY;
    });
};

export const tableReducers = {
  [ActionType.addTable]: addTable,
  [ActionType.moveTable]: moveTable,
};

export const actions = {
  addTableAction,
  moveTableAction,
};
