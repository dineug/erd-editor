import { Helper } from '@@types/core/helper';
import { Store } from '@@types/engine/store';
import { Column, ColumnOption } from '@@types/engine/store/table.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import {
  AddCustomColumnUI,
  AddCustomColumnValue,
} from '@@types/engine/command/column.cmd';
import { uuid } from '@/core/helper';
import { getChangeOption } from '@/engine/store/helper/column.helper';
import { createCommand } from './helper';
import { SIZE_MIN_WIDTH } from '@/core/layout';

export * from './column.cmd.helper.gen';

export const addColumn = (store: Store, tableId?: string) =>
  createCommand(
    'column.add',
    tableId
      ? [
          {
            id: uuid(),
            tableId,
          },
        ]
      : store.tableState.tables
          .filter(table => table.ui.active)
          .map(table => {
            return {
              id: uuid(),
              tableId: table.id,
            };
          })
  );

export const addCustomColumn = (
  option: ColumnOption | null,
  ui: AddCustomColumnUI | null,
  value: AddCustomColumnValue | null,
  tableIds: string[]
) =>
  createCommand(
    'column.addCustom',
    tableIds.map(tableId => ({
      tableId,
      id: uuid(),
      option,
      ui,
      value,
    }))
  );

export const removeColumn = (tableId: string, columnIds: string[]) =>
  createCommand('column.remove', {
    tableId,
    columnIds,
  });

export const removeOnlyColumn = (tableId: string, columnIds: string[]) =>
  createCommand('column.removeOnly', {
    tableId,
    columnIds,
  });

export function changeColumnName(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
) {
  const width = helper.getTextWidth(value);
  return createCommand('column.changeName', {
    tableId,
    columnId,
    value,
    width: width < SIZE_MIN_WIDTH ? SIZE_MIN_WIDTH : width,
  });
}

export function changeColumnComment(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
) {
  const width = helper.getTextWidth(value);
  return createCommand('column.changeComment', {
    tableId,
    columnId,
    value,
    width: width < SIZE_MIN_WIDTH ? SIZE_MIN_WIDTH : width,
  });
}

export function changeColumnDataType(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
) {
  const width = helper.getTextWidth(value);
  return createCommand('column.changeDataType', {
    tableId,
    columnId,
    value,
    width: width < SIZE_MIN_WIDTH ? SIZE_MIN_WIDTH : width,
  });
}

export function changeColumnDefault(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
) {
  const width = helper.getTextWidth(value);
  return createCommand('column.changeDefault', {
    tableId,
    columnId,
    value,
    width: width < SIZE_MIN_WIDTH ? SIZE_MIN_WIDTH : width,
  });
}

export const changeColumnAutoIncrement = (
  { tableState: { tables } }: Store,
  tableId: string,
  columnId: string
) =>
  createCommand('column.changeAutoIncrement', {
    tableId,
    columnId,
    value: getChangeOption(tables, tableId, columnId, 'autoIncrement'),
  });

export const changeColumnPrimaryKey = (
  { tableState: { tables } }: Store,
  tableId: string,
  columnId: string
) =>
  createCommand('column.changePrimaryKey', {
    tableId,
    columnId,
    value: getChangeOption(tables, tableId, columnId, 'primaryKey'),
  });

export const changeColumnUnique = (
  { tableState: { tables } }: Store,
  tableId: string,
  columnId: string
) =>
  createCommand('column.changeUnique', {
    tableId,
    columnId,
    value: getChangeOption(tables, tableId, columnId, 'unique'),
  });

export const changeColumnNotNull = (
  { tableState: { tables } }: Store,
  tableId: string,
  columnId: string
) =>
  createCommand('column.changeNotNull', {
    tableId,
    columnId,
    value: getChangeOption(tables, tableId, columnId, 'notNull'),
  });

export const moveColumn = (
  tableId: string,
  columnIds: string[],
  targetTableId: string,
  targetColumnId: string
) =>
  createCommand('column.move', {
    tableId,
    columnIds,
    targetTableId,
    targetColumnId,
  });

export const activeColumn = ({ start, end }: Relationship) =>
  createCommand('column.active', [
    {
      tableId: start.tableId,
      columnIds: start.columnIds,
    },
    {
      tableId: end.tableId,
      columnIds: end.columnIds,
    },
  ]);

export const activeEndColumn = ({ start, end }: Relationship) =>
  createCommand('column.activeEnd', [
    {
      tableId: start.tableId,
      columnIds: start.columnIds,
    },
    {
      tableId: end.tableId,
      columnIds: end.columnIds,
    },
  ]);

export const loadColumn = (
  tableId: string,
  columns: Column[],
  indexList: number[]
) =>
  createCommand('column.load', {
    tableId,
    columns,
    indexList,
  });
