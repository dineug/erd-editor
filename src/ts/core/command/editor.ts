import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import { getData } from "../Helper";
import { FocusTableModel, FocusType } from "../model/FocusTableModel";

export interface FocusTable {
  tableId: string;
}
export function focusTable(tableId: string): CommandEffect<FocusTable> {
  return {
    name: "editor.focusTable",
    data: {
      tableId,
    },
  };
}
export function executeFocusTable(store: Store, data: FocusTable) {
  Logger.debug("executeFocusTable");
  const { tableState, editorState } = store;
  const table = getData(tableState.tables, data.tableId);
  if (
    table &&
    (editorState.focusTable === null ||
      editorState.focusTable.id !== data.tableId)
  ) {
    if (editorState.focusTable?.id !== table.id) {
      executeFocusEndTable(store);
      editorState.focusTable = new FocusTableModel(table, store);
    }
  }
}

export function focusEndTable(): CommandEffect<null> {
  return {
    name: "editor.focusEndTable",
    data: null,
  };
}
export function executeFocusEndTable(store: Store) {
  Logger.debug("executeFocusEndTable");
  const { editorState } = store;
  editorState.focusTable?.destroy();
  editorState.focusTable = null;
  executeEditEndTable(store);
}

export const moveKeys: MoveKey[] = [
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "ArrowLeft",
];
export type MoveKey = "ArrowUp" | "ArrowRight" | "ArrowDown" | "ArrowLeft";
export interface FocusMoveTable {
  moveKey: MoveKey;
  shiftKey: boolean;
}
export function focusMoveTable(
  moveKey: MoveKey,
  shiftKey: boolean
): CommandEffect<FocusMoveTable> {
  return {
    name: "editor.focusMoveTable",
    data: {
      moveKey,
      shiftKey,
    },
  };
}
export function executeFocusMoveTable(store: Store, data: FocusMoveTable) {
  Logger.debug("executeFocusMoveTable");
  const { focusTable } = store.editorState;
  focusTable?.move(data);
}

export interface FocusTargetTable {
  focusType: FocusType;
}
export function focusTargetTable(
  focusType: FocusType
): CommandEffect<FocusTargetTable> {
  return {
    name: "editor.focusTargetTable",
    data: {
      focusType,
    },
  };
}
export function executeFocusTargetTable(store: Store, data: FocusTargetTable) {
  Logger.debug("executeFocusTargetTable");
  const { focusTable } = store.editorState;
  focusTable?.focus({
    focusTargetTable: data,
  });
  executeEditEndTable(store);
}

export interface FocusTargetColumn {
  columnId: string;
  focusType: FocusType;
  ctrlKey: boolean;
  shiftKey: boolean;
}
export function focusTargetColumn(
  columnId: string,
  focusType: FocusType,
  ctrlKey: boolean,
  shiftKey: boolean
): CommandEffect<FocusTargetColumn> {
  return {
    name: "editor.focusTargetColumn",
    data: {
      columnId,
      focusType,
      ctrlKey,
      shiftKey,
    },
  };
}
export function executeFocusTargetColumn(
  store: Store,
  data: FocusTargetColumn
) {
  Logger.debug("executeFocusTargetColumn");
  const { focusTable } = store.editorState;
  focusTable?.focus({
    focusTargetColumn: data,
  });
  executeEditEndTable(store);
}

export function selectAllColumn(): CommandEffect<null> {
  return {
    name: "editor.selectAllColumn",
    data: null,
  };
}
export function executeSelectAllColumn(store: Store) {
  Logger.debug("executeSelectAllColumn");
  const { focusTable } = store.editorState;
  focusTable?.selectAll();
}

export function selectEndColumn(): CommandEffect<null> {
  return {
    name: "editor.selectEndColumn",
    data: null,
  };
}
export function executeSelectEndColumn(store: Store) {
  Logger.debug("executeSelectEndColumn");
  const { focusTable } = store.editorState;
  focusTable?.selectEnd();
}

export interface EditTable {
  id: string;
  focusType: FocusType;
}
export function editTable(
  id: string,
  focusType: FocusType
): CommandEffect<EditTable> {
  return {
    name: "editor.editTable",
    data: {
      id,
      focusType,
    },
  };
}
export function executeEditTable(store: Store, data: EditTable) {
  Logger.debug("executeEditTable");
  const { editorState } = store;
  editorState.editTable = data;
}

export function editEndTable(): CommandEffect<null> {
  return {
    name: "editor.editEndTable",
    data: null,
  };
}
export function executeEditEndTable(store: Store) {
  Logger.debug("executeEditEndTable");
  const { editorState } = store;
  editorState.editTable = null;
}

export interface DraggableColumn {
  tableId: string;
  columnIds: string[];
}
export function draggableColumn(
  store: Store,
  tableId: string,
  columnId: string,
  ctrlKey: boolean
): CommandEffect<DraggableColumn> {
  const columnIds: string[] = [];
  const { focusTable } = store.editorState;
  if (ctrlKey && focusTable) {
    focusTable.selectColumns.forEach((column) => columnIds.push(column.id));
  } else {
    columnIds.push(columnId);
  }
  return {
    name: "editor.draggableColumn",
    data: {
      tableId,
      columnIds,
    },
  };
}
export function executeDraggableColumn(store: Store, data: DraggableColumn) {
  Logger.debug("executeDraggableColumn");
  const { editorState } = store;
  editorState.draggableColumn = data;
}

export function draggableEndColumn(): CommandEffect<null> {
  return {
    name: "editor.draggableEndColumn",
    data: null,
  };
}
export function executeDraggableEndColumn(store: Store) {
  Logger.debug("executeDraggableEndColumn");
  const { editorState } = store;
  editorState.draggableColumn = null;
}
