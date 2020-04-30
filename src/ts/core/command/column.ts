import { Command } from "../Command";
import { SIZE_MIN_WIDTH } from "../Layout";
import { Logger } from "../Logger";
import { Store } from "../Store";
import { Column, ColumnOption } from "../store/Table";
import { Relationship } from "../store/Relationship";
import { Helper, getData, getIndex, uuid } from "../Helper";
import {
  relationshipSort,
  identificationValid,
  removeColumnRelationshipValid,
} from "../helper/RelationshipHelper";
import {
  getColumn,
  getChangeOption,
  getDataTypeSyncColumns,
} from "../helper/ColumnHelper";
import { ColumnModel } from "../model/ColumnModel";
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
): Command<"column.add"> {
  return {
    type: "column.add",
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
  const { relationships } = store.relationshipState;
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
  relationshipSort(tables, relationships);
}

interface AddCustomColumnUI {
  active: boolean;
  pk: boolean;
  fk: boolean;
  pfk: boolean;
}
interface AddCustomColumnValue {
  name: string;
  comment: string;
  dataType: string;
  default: string;
  widthName: number;
  widthComment: number;
  widthDataType: number;
  widthDefault: number;
}
export interface AddCustomColumn {
  tableId: string;
  id: string;
  option: ColumnOption | null;
  ui: AddCustomColumnUI | null;
  value: AddCustomColumnValue | null;
}
export function addCustomColumn(
  store: Store,
  option: ColumnOption | null,
  ui: AddCustomColumnUI | null,
  value: AddCustomColumnValue | null,
  tableIds: string[]
): Command<"column.addCustom"> {
  return {
    type: "column.addCustom",
    data: tableIds.map((tableId) => {
      return {
        tableId,
        id: uuid(),
        option,
        ui,
        value,
      };
    }),
  };
}
export function executeAddCustomColumn(store: Store, data: AddCustomColumn[]) {
  Logger.debug("executeAddCustomColumn");
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  data.forEach((addCustomColumn: AddCustomColumn) => {
    const table = getData(tables, addCustomColumn.tableId);
    if (table) {
      table.columns.push(new ColumnModel({ addCustomColumn }));
    }
  });
  relationshipSort(tables, relationships);
}

export interface RemoveColumn {
  tableId: string;
  columnIds: string[];
}
export function removeColumn(
  tableId: string,
  columnIds: string[]
): Command<"column.remove"> {
  return {
    type: "column.remove",
    data: {
      tableId,
      columnIds,
    },
  };
}
export function executeRemoveColumn(store: Store, data: RemoveColumn) {
  Logger.debug("executeRemoveColumn");
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  const table = getData(tables, data.tableId);
  if (table) {
    for (let i = 0; i < table.columns.length; i++) {
      const column = table.columns[i];
      if (data.columnIds.some((columnId) => columnId === column.id)) {
        table.columns.splice(i, 1);
        i--;
      }
    }
    // relationship valid
    removeColumnRelationshipValid(store, table, data.columnIds);
    identificationValid(store);
    relationshipSort(tables, relationships);
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
): Command<"column.changeName"> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    type: "column.changeName",
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
  const { relationships } = store.relationshipState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.name = data.value;
    column.ui.widthName = data.width;
    relationshipSort(tables, relationships);
  }
}

export function changeColumnComment(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): Command<"column.changeComment"> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    type: "column.changeComment",
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
  const { relationships } = store.relationshipState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.comment = data.value;
    column.ui.widthComment = data.width;
    relationshipSort(tables, relationships);
  }
}

export function changeColumnDataType(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): Command<"column.changeDataType"> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    type: "column.changeDataType",
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
  const { relationships } = store.relationshipState;
  const targetColumn = getColumn(tables, data.tableId, data.columnId);
  if (targetColumn) {
    const columns = getDataTypeSyncColumns(
      [targetColumn],
      tables,
      relationships
    );
    columns.forEach((column) => {
      column.dataType = data.value;
      column.ui.widthDataType = data.width;
    });
    relationshipSort(tables, relationships);
  }
}

export function changeColumnDefault(
  helper: Helper,
  tableId: string,
  columnId: string,
  value: string
): Command<"column.changeDefault"> {
  let width = helper.getTextWidth(value);
  if (width < SIZE_MIN_WIDTH) {
    width = SIZE_MIN_WIDTH;
  }
  return {
    type: "column.changeDefault",
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
  const { relationships } = store.relationshipState;
  const column = getColumn(tables, data.tableId, data.columnId);
  if (column) {
    column.default = data.value;
    column.ui.widthDefault = data.width;
    relationshipSort(tables, relationships);
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
): Command<"column.changeAutoIncrement"> {
  const { tables } = store.tableState;
  return {
    type: "column.changeAutoIncrement",
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
): Command<"column.changePrimaryKey"> {
  const { tables } = store.tableState;
  return {
    type: "column.changePrimaryKey",
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
  const table = getData(tables, data.tableId);
  const column = getColumn(tables, data.tableId, data.columnId);
  if (table && column) {
    if (data.value) {
      if (column.ui.fk) {
        column.ui.fk = false;
        column.ui.pfk = true;
      } else {
        column.ui.pk = true;
      }
      if (!column.option.notNull) {
        store.dispatch(changeColumnNotNull(store, data.tableId, data.columnId));
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
    // relationship valid
    identificationValid(store);
  }
}

export function changeColumnUnique(
  store: Store,
  tableId: string,
  columnId: string
): Command<"column.changeUnique"> {
  const { tables } = store.tableState;
  return {
    type: "column.changeUnique",
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
): Command<"column.changeNotNull"> {
  const { tables } = store.tableState;
  return {
    type: "column.changeNotNull",
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
): Command<"column.move"> {
  return {
    type: "column.move",
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
  const { relationships } = store.relationshipState;
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
        executeDraggableColumn(store, {
          tableId: data.targetTableId,
          columnIds: data.columnIds,
        });
        // relationship valid
        removeColumnRelationshipValid(store, currentTable, data.columnIds);
        identificationValid(store);
        relationshipSort(tables, relationships);
      }
    }
  }
}

export interface ActiveColumn {
  tableId: string;
  columnIds: string[];
}
export function activeColumn(
  relationship: Relationship
): Command<"column.active"> {
  const { start, end } = relationship;
  return {
    type: "column.active",
    data: [
      {
        tableId: start.tableId,
        columnIds: start.columnIds,
      },
      {
        tableId: end.tableId,
        columnIds: end.columnIds,
      },
    ],
  };
}
export function executeActiveColumn(store: Store, data: ActiveColumn[]) {
  Logger.debug("executeActiveColumn");
  const { tables } = store.tableState;
  data.forEach((activeColumn) => {
    const table = getData(tables, activeColumn.tableId);
    if (table) {
      activeColumn.columnIds.forEach((columnId) => {
        const column = getData(table.columns, columnId);
        if (column) {
          column.ui.active = true;
        }
      });
    }
  });
}

export function activeEndColumn(
  relationship: Relationship
): Command<"column.activeEnd"> {
  const { start, end } = relationship;
  return {
    type: "column.activeEnd",
    data: [
      {
        tableId: start.tableId,
        columnIds: start.columnIds,
      },
      {
        tableId: end.tableId,
        columnIds: end.columnIds,
      },
    ],
  };
}
export function executeActiveEndColumn(store: Store, data: ActiveColumn[]) {
  Logger.debug("executeActiveEndColumn");
  const { tables } = store.tableState;
  data.forEach((activeColumn) => {
    const table = getData(tables, activeColumn.tableId);
    if (table) {
      activeColumn.columnIds.forEach((columnId) => {
        const column = getData(table.columns, columnId);
        if (column) {
          column.ui.active = false;
        }
      });
    }
  });
}
