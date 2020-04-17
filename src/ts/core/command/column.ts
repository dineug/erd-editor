import { CommandEffect } from "../Command";
import { SIZE_MIN_WIDTH } from "../Layout";
import { Store } from "../Store";
import { Helper, getData, getIndex, uuid } from "../Helper";
import { Logger } from "../Logger";
import { ColumnModel } from "../model/ColumnModel";
import { getColumn, getChangeOption } from "../helper/ColumnHelper";
import {
  focusTableExecute,
  editEndTableExecute,
  draggableColumnExecute,
} from "./editor";

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
  editEndTableExecute(store);
  data.forEach((addColumn: AddColumn, index: number) => {
    const table = getData(tables, addColumn.tableId);
    if (table) {
      if (index === data.length - 1) {
        focusTableExecute(store, {
          tableId: table.id,
        });
      }
      table.columns.push(new ColumnModel({ addColumn }));
    }
  });
  // TODO: relationship sort
}

export interface RemoveColumn {
  tableId: string;
  columnIds: string[];
}
export function removeColumn(
  tableId: string,
  columnIds: string[]
): CommandEffect<RemoveColumn> {
  return {
    name: "column.remove",
    data: {
      tableId,
      columnIds,
    },
  };
}
export function removeColumnExecute(store: Store, data: RemoveColumn) {
  Logger.debug("removeColumnExecute");
  const { tables } = store.tableState;
  const table = getData(tables, data.tableId);
  if (table) {
    for (let i = 0; i < table.columns.length; i++) {
      const id = table.columns[i].id;
      if (data.columnIds.some(columnId => columnId === id)) {
        table.columns.splice(i, 1);
        i--;
      }
    }
    // TODO: relationship valid, sort
  }
}

export interface ChangeColumnValue {
  tableId: string;
  columnId: string;
  value: string;
  width: number;
}

export function changeColumnName(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandEffect<ChangeColumnValue> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    name: "column.changeName",
    data: {
      tableId,
      columnId,
      value,
      width,
    },
  };
}
export function changeColumnNameExecute(store: Store, data: ChangeColumnValue) {
  Logger.debug("changeColumnNameExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.name = data.value;
    column.ui.widthName = data.width;
    // TODO: relationship sort
  }
}

export function changeColumnComment(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandEffect<ChangeColumnValue> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    name: "column.changeComment",
    data: {
      tableId,
      columnId,
      value,
      width,
    },
  };
}
export function changeColumnCommentExecute(
  store: Store,
  data: ChangeColumnValue
) {
  Logger.debug("changeColumnCommentExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.comment = data.value;
    column.ui.widthComment = data.width;
    // TODO: relationship sort
  }
}

export function changeColumnDataType(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandEffect<ChangeColumnValue> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    name: "column.changeDataType",
    data: {
      tableId,
      columnId,
      value,
      width,
    },
  };
}
export function changeColumnDataTypeExecute(
  store: Store,
  data: ChangeColumnValue
) {
  Logger.debug("changeColumnDataTypeExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.dataType = data.value;
    column.ui.widthDataType = data.width;
    // TODO: relationship sort
  }
}

export function changeColumnDefault(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): CommandEffect<ChangeColumnValue> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    name: "column.changeDefault",
    data: {
      tableId,
      columnId,
      value,
      width,
    },
  };
}
export function changeColumnDefaultExecute(
  store: Store,
  data: ChangeColumnValue
) {
  Logger.debug("changeColumnDefaultExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.default = data.value;
    column.ui.widthDefault = data.width;
    // TODO: relationship sort
  }
}

export interface ChangeColumnOption {
  tableId: string;
  columnId: string;
  value: boolean;
}

export function changeColumnAutoIncrement(
  store: Store,
  tableId: string,
  columnId: string
): CommandEffect<ChangeColumnOption> {
  const { tables } = store.tableState;
  return {
    name: "column.changeAutoIncrement",
    data: {
      tableId,
      columnId,
      value: getChangeOption(tables, tableId, columnId, "autoIncrement"),
    },
  };
}
export function changeColumnAutoIncrementExecute(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("changeColumnAutoIncrementExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.option.autoIncrement = data.value;
  }
}

export function changeColumnPrimaryKey(
  store: Store,
  tableId: string,
  columnId: string
): CommandEffect<ChangeColumnOption> {
  const { tables } = store.tableState;
  return {
    name: "column.changePrimaryKey",
    data: {
      tableId,
      columnId,
      value: getChangeOption(tables, tableId, columnId, "primaryKey"),
    },
  };
}
export function changeColumnPrimaryKeyExecute(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("changeColumnPrimaryKeyExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    if (data.value) {
      if (column.ui.fk) {
        column.ui.fk = false;
        column.ui.pfk = true;
      } else {
        column.ui.pk = true;
      }
    } else {
      if (column.ui.pfk) {
        column.ui.pfk = false;
        column.ui.fk = true;
      } else {
        column.ui.pk = false;
      }
    }
    column.option.primaryKey = data.value;
  }
}

export function changeColumnUnique(
  store: Store,
  tableId: string,
  columnId: string
): CommandEffect<ChangeColumnOption> {
  const { tables } = store.tableState;
  return {
    name: "column.changeUnique",
    data: {
      tableId,
      columnId,
      value: getChangeOption(tables, tableId, columnId, "unique"),
    },
  };
}
export function changeColumnUniqueExecute(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("changeColumnUniqueExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.option.unique = data.value;
  }
}

export function changeColumnNotNull(
  store: Store,
  tableId: string,
  columnId: string
): CommandEffect<ChangeColumnOption> {
  const { tables } = store.tableState;
  return {
    name: "column.changeNotNull",
    data: {
      tableId,
      columnId,
      value: getChangeOption(tables, tableId, columnId, "notNull"),
    },
  };
}
export function changeColumnNotNullExecute(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("changeColumnNotNullExecute");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.option.notNull = data.value;
  }
}

export interface MoveColumn {
  tableId: string;
  columnId: string;
  targetTableId: string;
  targetColumnId: string;
}
export function moveColumn(
  tableId: string,
  columnId: string,
  targetTableId: string,
  targetColumnId: string
): CommandEffect<MoveColumn> {
  return {
    name: "column.move",
    data: {
      tableId,
      columnId,
      targetTableId,
      targetColumnId,
    },
  };
}
export function moveColumnExecute(store: Store, data: MoveColumn) {
  Logger.debug("moveColumnExecute");
  const { tables } = store.tableState;
  const currentTable = getData(tables, data.tableId);
  const currentColumn = getColumn(tables, data.tableId, data.columnId);
  const targetTable = getData(tables, data.targetTableId);
  const targetColumn = getColumn(
    tables,
    data.targetTableId,
    data.targetColumnId
  );
  if (currentTable && targetTable && currentColumn && targetColumn) {
    if (
      data.tableId === data.targetTableId &&
      data.columnId !== data.targetColumnId
    ) {
      const currentIndex = getIndex(targetTable.columns, currentColumn.id);
      const targetIndex = getIndex(targetTable.columns, targetColumn.id);
      if (currentIndex !== null && targetIndex !== null) {
        targetTable.columns.splice(currentIndex, 1);
        targetTable.columns.splice(targetIndex, 0, currentColumn);
      }
    } else if (
      data.tableId !== data.targetTableId &&
      data.columnId !== data.targetColumnId
    ) {
      const currentIndex = getIndex(currentTable.columns, currentColumn.id);
      const targetIndex = getIndex(targetTable.columns, targetColumn.id);
      if (currentIndex !== null && targetIndex !== null) {
        currentTable.columns.splice(currentIndex, 1);
        targetTable.columns.splice(targetIndex, 0, currentColumn);
        // TODO: relationship valid, sort

        draggableColumnExecute(store, {
          tableId: data.targetTableId,
          columnId: data.columnId,
        });
      }
    }
  }
}
