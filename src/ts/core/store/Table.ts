export interface TableState {
  tables: Table[];
}

export interface Table {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;

  width(): number;
  height(): number;
  maxWidthColumn(): ColumnWidth;
}

export interface ColumnWidth {
  width: number;
  name: number;
  comment: number;
  dataType: number;
  default: number;
  notNull: number;
  autoIncrement: number;
  unique: number;
}

export interface TableUI {
  active: boolean;
  top: number;
  left: number;
  zIndex: number;
  widthName: number;
  widthComment: number;
}

export interface Column {
  id: string;
  name: string;
  comment: string;
  dataType: string;
  default: string;
  option: ColumnOption;
  ui: ColumnUI;
}

export interface ColumnOption {
  autoIncrement: boolean;
  primaryKey: boolean;
  unique: boolean;
  notNull: boolean;
}
export type ColumnOptionKey = keyof ColumnOption;
export const columnOptionKeys: ColumnOptionKey[] = [
  "autoIncrement",
  "primaryKey",
  "unique",
  "notNull",
];

export interface ColumnUI {
  active: boolean;
  pk: boolean;
  fk: boolean;
  pfk: boolean;
  widthName: number;
  widthComment: number;
  widthDataType: number;
  widthDefault: number;
}

export function createTableState(): TableState {
  return {
    tables: [],
  };
}
