import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { getData, uuid } from "../Helper";
import { Logger } from "../Logger";
import { ColumnModel } from "../model/ColumnModel";
import { focusTableExecute } from "./editor";

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
      focusTableExecute(store, {
        tableId: table.id,
      });
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

export interface ChangeColumnNotNull {
  tableId: string;
  columnId: string;
  notNull: boolean;
}
export function changeColumnNotNull(
  store: Store,
  tableId: string,
  columnId: string
): CommandEffect<ChangeColumnNotNull> {
  let notNull = false;
  const { tables } = store.tableState;
  const table = getData(tables, tableId);
  if (table) {
    const column = getData(table.columns, columnId);
    if (column) {
      notNull = !column.option.notNull;
    }
  }
  return {
    name: "column.changeNotNull",
    data: {
      tableId,
      columnId,
      notNull,
    },
  };
}
export function changeColumnNotNullExecute(
  store: Store,
  data: ChangeColumnNotNull
) {
  Logger.debug("changeColumnNotNullExecute");
  const { tables } = store.tableState;
  const table = getData(tables, data.tableId);
  if (table) {
    const column = getData(table.columns, data.columnId);
    if (column) {
      column.option.notNull = data.notNull;
    }
  }
}
