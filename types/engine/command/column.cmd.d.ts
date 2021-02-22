import { Column, ColumnOption } from '../store/table.state';

export interface AddColumn {
  id: string;
  tableId: string;
}

interface AddCustomColumnUI {
  active: boolean;
  pk: boolean;
  fk: boolean;
  pfk: boolean;
}

interface AddCustomColumnValue {
  name: string;
  comment: string;
  dataType: string;
  default: string;
  widthName: number;
  widthComment: number;
  widthDataType: number;
  widthDefault: number;
}

export interface AddCustomColumn {
  tableId: string;
  id: string;
  option: ColumnOption | null;
  ui: AddCustomColumnUI | null;
  value: AddCustomColumnValue | null;
}

export interface RemoveColumn {
  tableId: string;
  columnIds: string[];
}

export interface ChangeColumnValue {
  tableId: string;
  columnId: string;
  value: string;
  width: number;
}

export interface ChangeColumnOption {
  tableId: string;
  columnId: string;
  value: boolean;
}

export interface MoveColumn {
  tableId: string;
  columnIds: string[];
  targetTableId: string;
  targetColumnId: string;
}

export interface ActiveColumn {
  tableId: string;
  columnIds: string[];
}

export interface LoadColumn {
  tableId: string;
  columns: Column[];
  indexList: number[];
}

export interface ColumnCommandMap {
  'column.add': Array<AddColumn>;
  'column.addCustom': Array<AddCustomColumn>;
  'column.remove': RemoveColumn;
  'column.changeName': ChangeColumnValue;
  'column.changeComment': ChangeColumnValue;
  'column.changeDataType': ChangeColumnValue;
  'column.changeDefault': ChangeColumnValue;
  'column.changeAutoIncrement': ChangeColumnOption;
  'column.changePrimaryKey': ChangeColumnOption;
  'column.changeUnique': ChangeColumnOption;
  'column.changeNotNull': ChangeColumnOption;
  'column.move': MoveColumn;
  'column.active': Array<ActiveColumn>;
  'column.activeEnd': Array<ActiveColumn>;
  'column.load': LoadColumn;
}
