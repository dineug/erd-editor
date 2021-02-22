import { Relationship } from '@@types/engine/store/relationship.state';
import { Table, Column } from '@@types/engine/store/table.state';
import { getData, getIndex } from '@/core/helper';

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
  let value = false;
  const column = getColumn(tables, tableId, columnId);
  if (column) {
    value = !column.option[columnOptionKey];
  }
  return value;
}
