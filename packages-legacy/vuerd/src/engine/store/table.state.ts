import { ColumnOptionKey, TableState } from '@@types/engine/store/table.state';

export const columnOptionKeys: ColumnOptionKey[] = [
  'autoIncrement',
  'primaryKey',
  'unique',
  'notNull',
];

export const createTableState = (): TableState => ({
  tables: [],
  indexes: [],
});
