import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { round } from 'lodash-es';

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
  if (!arrayHas(doc.tableIds)(id)) {
    doc.tableIds.push(id);
  }

  const table = createTable({ id });
  Object.assign(table.ui, ui);
  query(collections).collection('tableEntities').addOne(table);
};

export const moveTableAction = createAction<
  ActionMap[typeof ActionType.moveTable]
>(ActionType.moveTable);

const moveTable: ReducerType<typeof ActionType.moveTable> = (
  { collections },
  { ids, movementX, movementY }
) => {
  const collection = query(collections).collection('tableEntities');
  for (const id of ids) {
    collection.getOrCreate(id, id => createTable({ id }));
  }

  collection.updateMany(ids, table => {
    table.ui.x = round(table.ui.x + movementX, 4);
    table.ui.y = round(table.ui.y + movementY, 4);
  });
};

export const removeTableAction = createAction<
  ActionMap[typeof ActionType.removeTable]
>(ActionType.removeTable);

const removeTable: ReducerType<typeof ActionType.removeTable> = (
  { doc },
  { id }
) => {
  const index = doc.tableIds.indexOf(id);
  if (index !== -1) {
    doc.tableIds.splice(index, 1);
  }
};

export const changeTableNameAction = createAction<
  ActionMap[typeof ActionType.changeTableName]
>(ActionType.changeTableName);

const changeTableName: ReducerType<typeof ActionType.changeTableName> = (
  { collections },
  { id, value },
  { toWidth }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.updateOne(id, table => {
    table.name = value;
    table.ui.widthName = toWidth(value);
  });
};

export const changeTableCommentAction = createAction<
  ActionMap[typeof ActionType.changeTableComment]
>(ActionType.changeTableComment);

const changeTableComment: ReducerType<typeof ActionType.changeTableComment> = (
  { collections },
  { id, value },
  { toWidth }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.updateOne(id, table => {
    table.comment = value;
    table.ui.widthComment = toWidth(value);
  });
};

export const changeTableColorAction = createAction<
  ActionMap[typeof ActionType.changeTableColor]
>(ActionType.changeTableColor);

const changeTableColor: ReducerType<typeof ActionType.changeTableColor> = (
  { collections },
  { ids, color }
) => {
  const collection = query(collections).collection('tableEntities');
  for (const id of ids) {
    collection.getOrCreate(id, id => createTable({ id }));
  }

  collection.updateMany(ids, table => {
    table.ui.color = color;
  });
};

export const tableReducers = {
  [ActionType.addTable]: addTable,
  [ActionType.moveTable]: moveTable,
  [ActionType.removeTable]: removeTable,
  [ActionType.changeTableName]: changeTableName,
  [ActionType.changeTableComment]: changeTableComment,
  [ActionType.changeTableColor]: changeTableColor,
};

export const actions = {
  addTableAction,
  moveTableAction,
  removeTableAction,
  changeTableNameAction,
  changeTableCommentAction,
  changeTableColorAction,
};
