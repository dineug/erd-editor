import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { ColumnModel } from "../model/ColumnModel";

export interface AddColumn {
  id: string;
  tableId: string;
}
export function addColumn(store: Store): CommandEffect<Array<AddColumn>> {
  return {
    name: "column.add",
    data: store.tableState.tables
      .filter(table => table.ui.active)
      .map(table => {
        return {
          id: uuid(),
          tableId: table.id
        };
      })
  };
}
export function addColumnExecute(store: Store, data: AddColumn[]) {
  const { tables } = store.tableState;
  data.forEach(addColumn => {
    const table = getData(tables, addColumn.tableId);
    if (table) {
      table.columns.push(new ColumnModel({ addColumn }));
    }
  });
}

export interface RemoveColumn {
  id: string;
  tableId: string;
}
export function removeColumn(store: Store): CommandEffect<Array<RemoveColumn>> {
  return {
    name: "column.remove",
    data: []
  };
}
export function removeColumnExecute(store: Store, data: RemoveColumn[]) {}
