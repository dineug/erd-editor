import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { round } from 'lodash-es';

import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { query } from '@/utils/collection/query';
import { createTable } from '@/utils/collection/table.entity';
import { textInRange } from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addTableAction = createAction<
  ActionMap[typeof ActionType.addTable]
>(ActionType.addTable);

const addTable: ReducerType<typeof ActionType.addTable> = (
  { doc, collections, lww },
  { payload: { id, ui }, timestamp }
) => {
  query(collections)
    .collection('tableEntities')
    .addOne(createTable({ id, ui }))
    .addOperator(lww, timestamp, id, () => {
      if (!arrayHas(doc.tableIds)(id)) {
        doc.tableIds.push(id);
      }
    });
};

export const moveTableAction = createAction<
  ActionMap[typeof ActionType.moveTable]
>(ActionType.moveTable);

const moveTable: ReducerType<typeof ActionType.moveTable> = (
  { collections },
  { payload: { ids, movementX, movementY } }
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

export const moveToTableAction = createAction<
  ActionMap[typeof ActionType.moveToTable]
>(ActionType.moveToTable);

const moveToTable: ReducerType<typeof ActionType.moveToTable> = (
  { collections },
  { payload: { id, x, y } }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.updateOne(id, table => {
    table.ui.x = x;
    table.ui.y = y;
  });
};

export const removeTableAction = createAction<
  ActionMap[typeof ActionType.removeTable]
>(ActionType.removeTable);

const removeTable: ReducerType<typeof ActionType.removeTable> = (
  { doc, collections, lww },
  { payload: { id }, timestamp }
) => {
  query(collections)
    .collection('tableEntities')
    .removeOperator(lww, timestamp, id, () => {
      const index = doc.tableIds.indexOf(id);
      if (index !== -1) {
        doc.tableIds.splice(index, 1);
      }
    });
};

export const changeTableNameAction = createAction<
  ActionMap[typeof ActionType.changeTableName]
>(ActionType.changeTableName);

const changeTableName: ReducerType<typeof ActionType.changeTableName> = (
  { collections, lww },
  { payload: { id, value }, timestamp },
  { toWidth }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, timestamp, id, 'name', () => {
    collection.updateOne(id, table => {
      table.name = value;
      table.ui.widthName = textInRange(toWidth(value));
    });
  });
};

export const changeTableCommentAction = createAction<
  ActionMap[typeof ActionType.changeTableComment]
>(ActionType.changeTableComment);

const changeTableComment: ReducerType<typeof ActionType.changeTableComment> = (
  { collections, lww },
  { payload: { id, value }, timestamp },
  { toWidth }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, timestamp, id, 'comment', () => {
    collection.updateOne(id, table => {
      table.comment = value;
      table.ui.widthComment = textInRange(toWidth(value));
    });
  });
};

export const changeTableColorAction = createAction<
  ActionMap[typeof ActionType.changeTableColor]
>(ActionType.changeTableColor);

const changeTableColor: ReducerType<typeof ActionType.changeTableColor> = (
  { collections, lww },
  { payload: { id, color }, timestamp }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, timestamp, id, 'ui.color', () => {
    collection.updateOne(id, table => {
      table.ui.color = color;
    });
  });
};

export const changeZIndexAction = createAction<
  ActionMap[typeof ActionType.changeZIndex]
>(ActionType.changeZIndex);

const changeZIndex: ReducerType<typeof ActionType.changeZIndex> = (
  { collections },
  { payload: { id, zIndex } }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.updateOne(id, table => {
    table.ui.zIndex = zIndex;
  });
};

export const sortTableAction = createAction<
  ActionMap[typeof ActionType.sortTable]
>(ActionType.sortTable);

const sortTable: ReducerType<typeof ActionType.sortTable> = state => {
  const { doc, settings, collections } = state;
  const canvasWidth = settings.width;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const TABLE_MARGIN = 80;

  tables.sort((a, b) => a.columnIds.length - b.columnIds.length);

  let widthSum = 50;
  let currentHeight = 50;
  let maxHeight = 50;

  tables.forEach(table => {
    const width = calcTableWidths(table, state).width + TABLE_MARGIN;
    const height = calcTableHeight(table) + TABLE_MARGIN;

    if (widthSum + width > canvasWidth) {
      currentHeight += maxHeight;
      maxHeight = 0;
      widthSum = 50;
    }

    if (maxHeight < height) {
      maxHeight = height;
    }

    table.ui.y = currentHeight;
    table.ui.x = widthSum;
    widthSum += width;
  });
};

export const tableReducers = {
  [ActionType.addTable]: addTable,
  [ActionType.moveTable]: moveTable,
  [ActionType.moveToTable]: moveToTable,
  [ActionType.removeTable]: removeTable,
  [ActionType.changeTableName]: changeTableName,
  [ActionType.changeTableComment]: changeTableComment,
  [ActionType.changeTableColor]: changeTableColor,
  [ActionType.changeZIndex]: changeZIndex,
  [ActionType.sortTable]: sortTable,
};

export const actions = {
  addTableAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
  changeTableNameAction,
  changeTableCommentAction,
  changeTableColorAction,
  changeZIndexAction,
  sortTableAction,
};
