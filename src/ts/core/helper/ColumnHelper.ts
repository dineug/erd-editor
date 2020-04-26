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
        const index = relationship.start.columnIds.indexOf(target.id);
        if (index !== -1) {
          const columnId = relationship.end.columnIds[index];
          const table = getData(tables, relationship.end.tableId);
          if (table) {
            const column = getData(table.columns, columnId);
            if (column) {
              stack.push(column);
            }
          }
        } else {
          const index = relationship.end.columnIds.indexOf(target.id);
          if (index !== -1) {
            const columnId = relationship.start.columnIds[index];
            const table = getData(tables, relationship.start.tableId);
            if (table) {
              const column = getData(table.columns, columnId);
              if (column) {
                stack.push(column);
              }
            }
          }
        }
      });
    }
    getDataTypeSyncColumns(stack, tables, relationships, targetColumns);
  }
  return targetColumns;
}
