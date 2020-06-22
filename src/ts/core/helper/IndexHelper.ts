import { Store } from "../store";
import { Table } from "../store/Table";

export function removeValidColumnIndex(
  store: Store,
  table: Table,
  columnIds: string[]
) {
  const { indexes } = store.tableState;
  const tableIndexes = indexes.filter((index) => index.tableId === table.id);
  tableIndexes.forEach((index) => {
    for (let i = 0; i < index.columns.length; i++) {
      const id = index.columns[i].id;
      if (columnIds.some((columnId) => columnId === id)) {
        index.columns.splice(i, 1);
        i--;
      }
    }
  });
}

export function removeValidTableIndex(store: Store, tableIds: string[]) {
  const { indexes } = store.tableState;
  for (let i = 0; i < indexes.length; i++) {
    const id = indexes[i].tableId;
    if (tableIds.some((tableId) => tableId === id)) {
      indexes.splice(i, 1);
      i--;
    }
  }
}
