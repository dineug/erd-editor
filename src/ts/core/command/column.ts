import { CommandEffect } from "../Command";
import { SIZE_MIN_WIDTH } from "../Layout";
import { Store } from "../Store";
import { Helper, getData, getIndex, uuid } from "../Helper";
import { Logger } from "../Logger";
import { Column } from "../store/Table";
import { ColumnModel } from "../model/ColumnModel";
import { getColumn, getChangeOption } from "../helper/ColumnHelper";
import {
  executeFocusTable,
  executeEditEndTable,
  executeDraggableColumn,
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
          .filter((table) => table.ui.active)
          .map((table) => {
            return {
              id: uuid(),
              tableId: table.id,
            };
          }),
  };
}
export function executeAddColumn(store: Store, data: AddColumn[]) {
  Logger.debug("executeAddColumn");
  const { tables } = store.tableState;
  executeEditEndTable(store);
  data.forEach((addColumn: AddColumn, index: number) => {
    const table = getData(tables, addColumn.tableId);
    if (table) {
      if (index === data.length - 1) {
        executeFocusTable(store, {
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
export function executeRemoveColumn(store: Store, data: RemoveColumn) {
  Logger.debug("executeRemoveColumn");
  const { tables } = store.tableState;
  const table = getData(tables, data.tableId);
  if (table) {
    for (let i = 0; i < table.columns.length; i++) {
      const id = table.columns[i].id;
      if (data.columnIds.some((columnId) => columnId === id)) {
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
export function executeChangeColumnName(store: Store, data: ChangeColumnValue) {
  Logger.debug("executeChangeColumnName");
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
export function executeChangeColumnComment(
  store: Store,
  data: ChangeColumnValue
) {
  Logger.debug("executeChangeColumnComment");
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
export function executeChangeColumnDataType(
  store: Store,
  data: ChangeColumnValue
) {
  Logger.debug("executeChangeColumnDataType");
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
export function executeChangeColumnDefault(
  store: Store,
  data: ChangeColumnValue
) {
  Logger.debug("executeChangeColumnDefault");
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
export function executeChangeColumnAutoIncrement(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("executeChangeColumnAutoIncrement");
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
export function executeChangeColumnPrimaryKey(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("executeChangeColumnPrimaryKey");
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
export function executeChangeColumnUnique(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("executeChangeColumnUnique");
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
export function executeChangeColumnNotNull(
  store: Store,
  data: ChangeColumnOption
) {
  Logger.debug("executeChangeColumnNotNull");
  const { tables } = store.tableState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.option.notNull = data.value;
  }
}

export interface MoveColumn {
  tableId: string;
  columnIds: string[];
  targetTableId: string;
  targetColumnId: string;
}
export function moveColumn(
  tableId: string,
  columnIds: string[],
  targetTableId: string,
  targetColumnId: string
): CommandEffect<MoveColumn> {
  return {
    name: "column.move",
    data: {
      tableId,
      columnIds,
      targetTableId,
      targetColumnId,
    },
  };
}
export function executeMoveColumn(store: Store, data: MoveColumn) {
  Logger.debug("executeMoveColumn");
  const { tables } = store.tableState;
  const currentTable = getData(tables, data.tableId);
  let currentColumns: Column[] = [];
  data.columnIds.forEach((columnId) => {
    const column = getColumn(tables, data.tableId, columnId);
    if (column) {
      currentColumns.push(column);
    }
  });
  const targetTable = getData(tables, data.targetTableId);
  const targetColumn = getColumn(
    tables,
    data.targetTableId,
    data.targetColumnId
  );
  if (
    currentTable &&
    targetTable &&
    currentColumns.length !== 0 &&
    targetColumn
  ) {
    if (
      data.tableId === data.targetTableId &&
      !data.columnIds.some((columnId) => columnId === data.targetColumnId)
    ) {
      const targetIndex = getIndex(currentTable.columns, targetColumn.id);
      if (targetIndex !== null) {
        const currentIndex = getIndex(
          currentTable.columns,
          currentColumns[0].id
        );
        if (currentIndex !== null && currentIndex > targetIndex) {
          currentColumns = currentColumns.reverse();
        }
        currentColumns.forEach((currentColumn) => {
          const currentIndex = getIndex(currentTable.columns, currentColumn.id);
          if (currentIndex !== null) {
            currentTable.columns.splice(currentIndex, 1);
            currentTable.columns.splice(targetIndex, 0, currentColumn);
          }
        });
      }
    } else if (
      data.tableId !== data.targetTableId &&
      !data.columnIds.some((columnId) => columnId === data.targetColumnId)
    ) {
      const targetIndex = getIndex(targetTable.columns, targetColumn.id);
      if (targetIndex !== null) {
        const currentIndex = getIndex(
          currentTable.columns,
          currentColumns[0].id
        );
        if (currentIndex !== null && currentIndex > targetIndex) {
          currentColumns = currentColumns.reverse();
        }
        currentColumns.forEach((currentColumn) => {
          const currentIndex = getIndex(currentTable.columns, currentColumn.id);
          if (currentIndex !== null) {
            currentTable.columns.splice(currentIndex, 1);
            targetTable.columns.splice(targetIndex, 0, currentColumn);
          }
        });
        // TODO: relationship valid, sort
        executeDraggableColumn(store, {
          tableId: data.targetTableId,
          columnIds: data.columnIds,
        });
      }
    }
  }
}
