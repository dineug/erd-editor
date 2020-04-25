import { Table, Column } from "../store/Table";
import { getData } from "../Helper";

export function getColumn(
  tables: Table[],
  tableId: string,
  columnId: string
): Column | null {
  const table = getData(tables, tableId);
  if (table) {
    return getData(table.columns, columnId);
  }
  return null;
}

type ColumnOptionKey = "autoIncrement" | "primaryKey" | "unique" | "notNull";
export function getChangeOption(
  tables: Table[],
  tableId: string,
  columnId: string,
  columnOptionKey: ColumnOptionKey
): boolean {
  let value = false;
  const column = getColumn(tables, tableId, columnId);
  if (column) {
    value = !column.option[columnOptionKey];
  }
  return value;
}

export function getColumnIds(columns: Column[]): string[] {
  const ids: string[] = [];
  columns.forEach((column) => {
    if (column.option.primaryKey) {
      ids.push(column.id);
    }
  });
  return ids;
}

export function getColumns(table: Table, columnIds: string[]): Column[] {
  const columns: Column[] = [];
  columnIds.forEach((columnId) => {
    const column = getData(table.columns, columnId);
    if (column) {
      columns.push(column);
    }
  });
  return columns;
}
