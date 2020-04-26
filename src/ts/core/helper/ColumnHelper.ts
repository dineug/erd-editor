import { getData, getIndex } from "../Helper";
import { Table, Column } from "../store/Table";
import { Relationship } from "../store/Relationship";

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

export function getDataTypeSyncColumns(
  stack: Column[],
  tables: Table[],
  relationships: Relationship[],
  targetColumns: Column[] = []
): Column[] {
  const target = stack.pop();
  if (target) {
    if (getIndex(targetColumns, target.id) === null) {
      targetColumns.push(target);
      relationships.forEach((relationship) => {
        const { start, end } = relationship;
        const index = start.columnIds.indexOf(target.id);
        if (index !== -1) {
          const columnId = end.columnIds[index];
          const column = getColumn(tables, end.tableId, columnId);
          if (column) {
            stack.push(column);
          }
        } else {
          const index = end.columnIds.indexOf(target.id);
          if (index !== -1) {
            const columnId = start.columnIds[index];
            const column = getColumn(tables, start.tableId, columnId);
            if (column) {
              stack.push(column);
            }
          }
        }
      });
    }
    getDataTypeSyncColumns(stack, tables, relationships, targetColumns);
  }
  return targetColumns;
}
