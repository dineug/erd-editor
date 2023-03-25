import { ValuesType } from '@/internal-types';

export interface TableEntity {
  tables: Table[];
  indexes: Index[]; // ADD: version 1.2.0
}

export interface Table {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;
  visible?: boolean;
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
  color?: string; // ADD: version 2.1.?
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

export interface Index {
  id: string;
  name: string;
  tableId: string;
  columns: IndexColumn[];
  unique: boolean;
}

export interface IndexColumn {
  id: string;
  orderType: OrderType;
}

export const OrderType = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const;
export type OrderType = ValuesType<typeof OrderType>;
export const OrderTypeList: ReadonlyArray<string> = Object.assign(OrderType);
