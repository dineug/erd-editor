import { isArray, isBoolean, isNill, isNumber, isString } from '@dineug/shared';

import { assign, validString } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  Column,
  Index,
  IndexColumn,
  OrderType,
  OrderTypeList,
  Table,
  TableEntity,
} from '@/v2/schema/tableEntity';

const createTableEntity = (): TableEntity => ({
  tables: [],
  indexes: [],
});

const createTable = (): Table => ({
  id: '',
  name: '',
  comment: '',
  columns: [],
  ui: {
    active: false,
    left: 200,
    top: 100,
    zIndex: 2,
    widthName: 60,
    widthComment: 60,
  },
  visible: true,
});

const createColumn = (): Column => ({
  id: '',
  name: '',
  comment: '',
  dataType: '',
  default: '',
  option: {
    autoIncrement: false,
    primaryKey: false,
    unique: false,
    notNull: false,
  },
  ui: {
    active: false,
    pk: false,
    fk: false,
    pfk: false,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
});

const createIndex = (): Index => ({
  id: '',
  name: '',
  tableId: '',
  columns: [],
  unique: false,
});

const createIndexColumn = (): IndexColumn => ({
  id: '',
  orderType: OrderType.ASC,
});

export function createAndMergeTableEntity(
  json?: DeepPartial<TableEntity>
): TableEntity {
  const entity = createTableEntity();
  if (isNill(json)) return entity;

  if (isArray(json.tables)) {
    for (const table of json.tables) {
      const targetTable = createTable();
      const assignString = assign(isString, targetTable, table);
      const assignBoolean = assign(isBoolean, targetTable, table);
      const uiAssignNumber = assign(isNumber, targetTable.ui, table.ui);
      const uiAssignBoolean = assign(isBoolean, targetTable.ui, table.ui);
      const uiAssignString = assign(isString, targetTable.ui, table.ui);

      assignString('id');
      assignString('name');
      assignString('comment');
      assignBoolean('visible');

      uiAssignBoolean('active');
      uiAssignString('color');
      uiAssignNumber('left');
      uiAssignNumber('top');
      uiAssignNumber('zIndex');
      uiAssignNumber('widthName');
      uiAssignNumber('widthComment');

      if (isArray(table.columns)) {
        for (const column of table.columns) {
          const targetColumn = createColumn();
          const assignString = assign(isString, targetColumn, column);
          const uiAssignNumber = assign(isNumber, targetColumn.ui, column.ui);
          const uiAssignBoolean = assign(isBoolean, targetColumn.ui, column.ui);
          const optionAssignBoolean = assign(
            isBoolean,
            targetColumn.option,
            column.option
          );

          assignString('id');
          assignString('name');
          assignString('comment');
          assignString('dataType');
          assignString('default');

          optionAssignBoolean('autoIncrement');
          optionAssignBoolean('primaryKey');
          optionAssignBoolean('unique');
          optionAssignBoolean('notNull');

          uiAssignBoolean('active');
          uiAssignBoolean('pk');
          uiAssignBoolean('fk');
          uiAssignBoolean('pfk');
          uiAssignNumber('widthName');
          uiAssignNumber('widthComment');
          uiAssignNumber('widthDataType');
          uiAssignNumber('widthDefault');

          targetTable.columns.push(targetColumn);
        }
      }

      entity.tables.push(targetTable);
    }
  }

  if (isArray(json.indexes)) {
    for (const index of json.indexes) {
      const targetIndex = createIndex();
      const assignString = assign(isString, targetIndex, index);
      const assignBoolean = assign(isBoolean, targetIndex, index);

      assignString('id');
      assignString('name');
      assignString('tableId');
      assignBoolean('unique');

      if (isArray(index.columns)) {
        for (const column of index.columns) {
          const targetColumn = createIndexColumn();

          assign(isString, targetColumn, column)('id');
          assign(validString(OrderTypeList), targetColumn, column)('orderType');

          targetIndex.columns.push(targetColumn);
        }
      }

      entity.indexes.push(targetIndex);
    }
  }

  return entity;
}
