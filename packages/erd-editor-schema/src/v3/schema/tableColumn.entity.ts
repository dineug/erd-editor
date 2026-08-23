import { EntityType } from '@/internal-types';

export type Column = EntityType<{
  id: string;
  tableId: string;
  name: string;
  comment: string;
  dataType: string;
  default: string;
  options: number;
  ui: ColumnUI;
}>;

export type ColumnUI = {
  keys: number;
  widthName: number;
  widthComment: number;
  widthDataType: number;
  widthDefault: number;
};

export const ColumnOption = {
  autoIncrement: 1,
  primaryKey: 2,
  unique: 4,
  notNull: 8,
} as const;

export const ColumnUIKey = {
  primaryKey: 1,
  foreignKey: 2,
} as const;
