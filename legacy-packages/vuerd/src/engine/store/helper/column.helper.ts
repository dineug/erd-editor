import { createBalanceRange, getData, getIndex } from '@/core/helper';
import { SIZE_MAX_WIDTH_COMMENT, SIZE_MIN_WIDTH } from '@/core/layout';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Column, Table } from '@@types/engine/store/table.state';

export function getColumn(
  tables: Table[],
  tableId: string,
  columnId: string
): Column | null | undefined {
  const table = getData(tables, tableId);
  return table ? getData(table.columns, columnId) : null;
}

export function getDataTypeSyncColumns(
  stack: Column[],
  tables: Table[],
  relationships: Relationship[],
  targetColumns: Column[] = []
): Column[] {
  const target = stack.pop();

  if (target) {
    if (getIndex(targetColumns, target.id) === -1) {
      targetColumns.push(target);
      relationships.forEach(relationship => {
        const { start, end } = relationship;
        const index = start.columnIds.indexOf(target.id);

        if (index !== -1) {
          const columnId = end.columnIds[index];
          const column = getColumn(tables, end.tableId, columnId);

          column && stack.push(column);
        } else {
          const index = end.columnIds.indexOf(target.id);

          if (index !== -1) {
            const columnId = start.columnIds[index];
            const column = getColumn(tables, start.tableId, columnId);

            column && stack.push(column);
          }
        }
      });
    }

    getDataTypeSyncColumns(stack, tables, relationships, targetColumns);
  }

  return targetColumns;
}

export function getChangeOption(
  tables: Table[],
  tableId: string,
  columnId: string,
  columnOptionKey: 'autoIncrement' | 'primaryKey' | 'unique' | 'notNull'
): boolean {
  const column = getColumn(tables, tableId, columnId);
  return column ? !column.option[columnOptionKey] : false;
}

export function getColumns(table: Table, columnIds: string[]): Column[] {
  const columns: Column[] = [];
  columnIds.forEach(columnId => {
    const column = getData(table.columns, columnId);
    if (!column) return;

    columns.push(column);
  });
  return columns;
}

export const commentWidthBalanceRange = createBalanceRange(
  SIZE_MIN_WIDTH,
  SIZE_MAX_WIDTH_COMMENT
);

export const widthBalanceRange = createBalanceRange(SIZE_MIN_WIDTH, 10000);
