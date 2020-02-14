import { Column, Table } from "../table";
import { Relationship } from "../relationship";
import { getData } from "@/ts/util";

export function getDataTypeSyncColumns(
  queue: Column[],
  tables: Table[],
  relationships: Relationship[],
  results: Column[] = []
): Column[] {
  const target = queue.pop();
  if (target) {
    if (results.indexOf(target) === -1) {
      results.push(target);
      relationships.forEach(relationship => {
        const index = relationship.start.columnIds.indexOf(target.id);
        if (index !== -1) {
          const columnId = relationship.end.columnIds[index];
          const table = getData(tables, relationship.end.tableId);
          if (table) {
            const column = getData(table.columns, columnId);
            if (column) {
              queue.push(column);
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
                queue.push(column);
              }
            }
          }
        }
      });
    }
    getDataTypeSyncColumns(queue, tables, relationships, results);
  }
  return results;
}
