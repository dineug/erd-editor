import { Store } from '../store';
import { CommandType } from './index';
import { AddCustomColumnUI, AddCustomColumnValue } from './column.cmd';
import { Column, ColumnOption } from '../store/table.state';
import { Relationship } from '../store/relationship.state';
import { Helper } from '../../core/helper';

export * from './column.cmd.helper.gen';

export declare function addColumn(
  store: Store,
  tableId?: string
): CommandType<'column.add'>;

export declare function addCustomColumn(
  option: ColumnOption | null,
  ui: AddCustomColumnUI | null,
  value: AddCustomColumnValue | null,
  tableIds: string[]
): CommandType<'column.addCustom'>;

export declare function removeColumn(
  tableId: string,
  columnIds: string[]
): CommandType<'column.remove'>;

export declare function changeColumnName(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandType<'column.changeName'>;

export declare function changeColumnComment(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandType<'column.changeComment'>;

export declare function changeColumnDataType(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandType<'column.changeDataType'>;

export declare function changeColumnDefault(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandType<'column.changeDefault'>;

export declare function changeColumnAutoIncrement(
  store: Store,
  tableId: string,
  columnId: string
): CommandType<'column.changeAutoIncrement'>;

export declare function changeColumnPrimaryKey(
  store: Store,
  tableId: string,
  columnId: string
): CommandType<'column.changePrimaryKey'>;

export declare function changeColumnUnique(
  store: Store,
  tableId: string,
  columnId: string
): CommandType<'column.changeUnique'>;

export declare function changeColumnNotNull(
  store: Store,
  tableId: string,
  columnId: string
): CommandType<'column.changeNotNull'>;

export declare function moveColumn(
  tableId: string,
  columnIds: string[],
  targetTableId: string,
  targetColumnId: string
): CommandType<'column.move'>;

export declare function activeColumn(
  relationship: Relationship
): CommandType<'column.active'>;

export declare function activeEndColumn(
  relationship: Relationship
): CommandType<'column.activeEnd'>;

export declare function loadColumn(
  tableId: string,
  columns: Column[],
  indexList: number[]
): CommandType<'column.load'>;
