import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { Logger } from "../Logger";
import { ColumnModel } from "../model/ColumnModel";

export interface AddColumn {
  id: string;
  tableId: string;
}
export function addColumn(
  store: Store,
  tableId?: string
): CommandEffect<Array<AddColumn>> {
  return {
    name: "column.add",
    data: tableId
      ? [
          {
            id: uuid(),
            tableId,
          },
        ]
      : store.tableState.tables
          .filter(table => table.ui.active)
          .map(table => {
            return {
              id: uuid(),
              tableId: table.id,
            };
          }),
  };
}
export function addColumnExecute(store: Store, data: AddColumn[]) {
  Logger.debug("addColumnExecute");
  const { tables } = store.tableState;
  data.forEach(addColumn => {
    const table = getData(tables, addColumn.tableId);
    if (table) {
      table.columns.push(new ColumnModel({ addColumn }));
    }
  });
}

export interface RemoveColumn {
  columnIds: string[];
  tableId: string;
}
export function removeColumn(store: Store): CommandEffect<Array<RemoveColumn>> {
  // TODO: focus select method
  return {
    name: "column.remove",
    data: [],
  };
}
export function removeColumnExecute(store: Store, data: RemoveColumn[]) {
  Logger.debug("removeColumnExecute");
}
