import {SIZE_MIN_WIDTH} from '@/ts/layout';
import {Column, Table} from '@/store/table';
import StoreManagement from '@/store/StoreManagement';
import ColumnModel from '@/models/ColumnModel';
import {autoName, uuid, getData} from '@/ts/util';

export function columnIds(table: Table): string[] {
  const ids: string[] = [];
  table.columns.forEach((column: Column) => {
    if (column.option.primaryKey) {
      ids.push(column.id);
    }
  });
  return ids;
}

export function createPrimaryKey(store: StoreManagement, table: Table) {
  let result = false;
  for (const column of table.columns) {
    if (column.option.primaryKey) {
      result = true;
      break;
    }
  }
  if (!result) {
    const id = uuid();
    const column: Column = {
      id,
      name: autoName(table.columns, id, 'unnamed'),
      comment: '',
      dataType: '',
      default: '',
      option: {
        autoIncrement: false,
        primaryKey: true,
        unique: false,
        notNull: false,
      },
      ui: {
        active: false,
        pk: true,
        fk: false,
        pfk: false,
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH,
        widthDataType: SIZE_MIN_WIDTH,
        widthDefault: SIZE_MIN_WIDTH,
      },
    };
    table.columns.push(new ColumnModel(store, column));
  }
}

export function createColumns(store: StoreManagement, tableId: string, table: Table): string[] {
  const ids: string[] = [];
  const targetTable = getData(store.tableStore.state.tables, tableId);
  if (targetTable) {
    targetTable.columns.forEach((column) => {
      if (column.option.primaryKey) {
        const id = uuid();
        table.columns.push(new ColumnModel(store, {
          id,
          name: column.name,
          comment: column.comment,
          dataType: column.dataType,
          default: column.default,
          option: {
            autoIncrement: false,
            primaryKey: false,
            unique: false,
            notNull: column.option.notNull,
          },
          ui: {
            active: false,
            pk: false,
            fk: true,
            pfk: false,
            widthName: column.ui.widthName,
            widthComment: column.ui.widthComment,
            widthDataType: column.ui.widthDataType,
            widthDefault: column.ui.widthDefault,
          },
        }));
        ids.push(id);
      }
    });
  }
  return ids;
}
