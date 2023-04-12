import { EntityType } from '@/internal-types';

export type Column = EntityType<{
  id: string;
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
  autoIncrement: /* */ 0b0000000000000000000000000000001,
  primaryKey: /*    */ 0b0000000000000000000000000000010,
  unique: /*        */ 0b0000000000000000000000000000100,
  notNull: /*       */ 0b0000000000000000000000000001000,
} as const;

export const ColumnUIKey = {
  primaryKey: /* */ 0b0000000000000000000000000000001,
  foreignKey: /* */ 0b0000000000000000000000000000010,
} as const;
