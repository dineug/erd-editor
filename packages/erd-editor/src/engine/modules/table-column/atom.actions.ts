import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { query } from '@/utils/collection/query';
import { addAndSort } from '@/utils/collection/sequence';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { textInRange } from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addColumnAction = createAction<
  ActionMap[typeof ActionType.addColumn]
>(ActionType.addColumn);

const addColumn: ReducerType<typeof ActionType.addColumn> = (
  { collections, lww },
  { payload: { id, tableId }, timestamp }
) => {
  const tableCollection = query(collections).collection('tableEntities');
  const table = tableCollection.getOrCreate(tableId, id => createTable({ id }));
  const column = createColumn({ id, tableId });

  query(collections)
    .collection('tableColumnEntities')
    .addOne(column)
    .addOperator(lww, timestamp, id, () => {
      if (!arrayHas(table.columnIds)(id)) {
        tableCollection.updateOne(tableId, table => {
          addAndSort(table.columnIds, table.seqColumnIds, id);
        });
      }
    });
};

export const removeColumnAction = createAction<
  ActionMap[typeof ActionType.removeColumn]
>(ActionType.removeColumn);

const removeColumn: ReducerType<typeof ActionType.removeColumn> = (
  { collections, lww },
  { payload: { id, tableId }, timestamp }
) => {
  const tableCollection = query(collections).collection('tableEntities');
  const table = tableCollection.getOrCreate(tableId, id => createTable({ id }));

  query(collections)
    .collection('tableColumnEntities')
    .removeOperator(lww, timestamp, id, () => {
      const index = table.columnIds.indexOf(id);
      if (index !== -1) {
        tableCollection.updateOne(tableId, table => {
          table.columnIds.splice(index, 1);
        });
      }
    });
};

export const changeColumnNameAction = createAction<
  ActionMap[typeof ActionType.changeColumnName]
>(ActionType.changeColumnName);

const changeColumnName: ReducerType<typeof ActionType.changeColumnName> = (
  { collections, lww },
  { payload: { id, value }, timestamp },
  { toWidth }
) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'name', () => {
    collection.updateOne(id, column => {
      column.name = value;
      column.ui.widthName = textInRange(toWidth(value));
    });
  });
};

export const changeColumnCommentAction = createAction<
  ActionMap[typeof ActionType.changeColumnComment]
>(ActionType.changeColumnComment);

const changeColumnComment: ReducerType<
  typeof ActionType.changeColumnComment
> = (
  { collections, lww },
  { payload: { id, value }, timestamp },
  { toWidth }
) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'comment', () => {
    collection.updateOne(id, column => {
      column.comment = value;
      column.ui.widthComment = textInRange(toWidth(value));
    });
  });
};

export const changeColumnDataTypeAction = createAction<
  ActionMap[typeof ActionType.changeColumnDataType]
>(ActionType.changeColumnDataType);

const changeColumnDataType: ReducerType<
  typeof ActionType.changeColumnDataType
> = (
  { collections, lww },
  { payload: { id, value }, timestamp },
  { toWidth }
) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'dataType', () => {
    collection.updateOne(id, column => {
      column.dataType = value;
      column.ui.widthDataType = textInRange(toWidth(value));
    });
  });
};

export const changeColumnDefaultAction = createAction<
  ActionMap[typeof ActionType.changeColumnDefault]
>(ActionType.changeColumnDefault);

const changeColumnDefault: ReducerType<
  typeof ActionType.changeColumnDefault
> = (
  { collections, lww },
  { payload: { id, value }, timestamp },
  { toWidth }
) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'default', () => {
    collection.updateOne(id, column => {
      column.default = value;
      column.ui.widthDefault = textInRange(toWidth(value));
    });
  });
};

export const changeColumnAutoIncrementAction = createAction<
  ActionMap[typeof ActionType.changeColumnAutoIncrement]
>(ActionType.changeColumnAutoIncrement);

const changeColumnAutoIncrement: ReducerType<
  typeof ActionType.changeColumnAutoIncrement
> = ({ collections, lww }, { payload: { id, value }, timestamp }) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(
    lww,
    timestamp,
    id,
    'options(autoIncrement)',
    () => {
      collection.updateOne(id, column => {
        column.options = value
          ? column.options | ColumnOption.autoIncrement
          : column.options & ~ColumnOption.autoIncrement;
      });
    }
  );
};

export const changeColumnPrimaryKeyAction = createAction<
  ActionMap[typeof ActionType.changeColumnPrimaryKey]
>(ActionType.changeColumnPrimaryKey);

const changeColumnPrimaryKey: ReducerType<
  typeof ActionType.changeColumnPrimaryKey
> = ({ collections, lww }, { payload: { id, value }, timestamp }) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'options(primaryKey)', () => {
    collection.updateOne(id, column => {
      column.options = value
        ? column.options | ColumnOption.primaryKey
        : column.options & ~ColumnOption.primaryKey;
      column.ui.keys = value
        ? column.ui.keys | ColumnUIKey.primaryKey
        : column.ui.keys & ~ColumnUIKey.primaryKey;
    });
  });
};

export const changeColumnUniqueAction = createAction<
  ActionMap[typeof ActionType.changeColumnUnique]
>(ActionType.changeColumnUnique);

const changeColumnUnique: ReducerType<typeof ActionType.changeColumnUnique> = (
  { collections, lww },
  { payload: { id, value }, timestamp }
) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'options(unique)', () => {
    collection.updateOne(id, column => {
      column.options = value
        ? column.options | ColumnOption.unique
        : column.options & ~ColumnOption.unique;
    });
  });
};

export const changeColumnNotNullAction = createAction<
  ActionMap[typeof ActionType.changeColumnNotNull]
>(ActionType.changeColumnNotNull);

const changeColumnNotNull: ReducerType<
  typeof ActionType.changeColumnNotNull
> = ({ collections, lww }, { payload: { id, value }, timestamp }) => {
  const collection = query(collections).collection('tableColumnEntities');
  collection.getOrCreate(id, id => createColumn({ id }));

  collection.replaceOperator(lww, timestamp, id, 'options(notNull)', () => {
    collection.updateOne(id, column => {
      column.options = value
        ? column.options | ColumnOption.notNull
        : column.options & ~ColumnOption.notNull;
    });
  });
};

export const tableColumnReducers = {
  [ActionType.addColumn]: addColumn,
  [ActionType.removeColumn]: removeColumn,
  [ActionType.changeColumnName]: changeColumnName,
  [ActionType.changeColumnComment]: changeColumnComment,
  [ActionType.changeColumnDataType]: changeColumnDataType,
  [ActionType.changeColumnDefault]: changeColumnDefault,
  [ActionType.changeColumnAutoIncrement]: changeColumnAutoIncrement,
  [ActionType.changeColumnPrimaryKey]: changeColumnPrimaryKey,
  [ActionType.changeColumnUnique]: changeColumnUnique,
  [ActionType.changeColumnNotNull]: changeColumnNotNull,
};

export const actions = {
  addColumnAction,
  removeColumnAction,
  changeColumnNameAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnAutoIncrementAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  changeColumnNotNullAction,
};
