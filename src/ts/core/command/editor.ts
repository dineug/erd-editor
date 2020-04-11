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
export function focusTableExecute(store: Store, data: FocusTable) {
  Logger.debug("focusTableExecute");
  const { tableState, editorState, canvasState } = store;
  const table = getData(tableState.tables, data.tableId);
  if (
    table &&
    (editorState.focusTable === null ||
      editorState.focusTable.id !== data.tableId)
  ) {
    editorState.focusTable = new FocusTableModel(table, canvasState.show);
  }
}

export function focusTableEnd(): CommandEffect<null> {
  return {
    name: "editor.focusTableEnd",
    data: null,
  };
}
export function focusTableEndExecute(store: Store) {
  Logger.debug("focusTableEndExecute");
  const { editorState } = store;
  editorState.focusTable = null;
  editTableEndExecute(store);
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
export function focusMoveTableExecute(store: Store, data: FocusMoveTable) {
  Logger.debug("focusMoveTableExecute");
  const { focusTable } = store.editorState;
  if (focusTable) {
    focusTable.move(data);
  }
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
export function editTableExecute(store: Store, data: EditTable) {
  Logger.debug("editTableExecute");
  const { editorState } = store;
  editorState.editTable = {
    id: data.id,
    focusType: data.focusType,
  };
}

export function editTableEnd(): CommandEffect<null> {
  return {
    name: "editor.editTableEnd",
    data: null,
  };
}
export function editTableEndExecute(store: Store) {
  Logger.debug("editTableEndExecute");
  const { editorState } = store;
  editorState.editTable = null;
}
