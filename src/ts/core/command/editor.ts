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
  const { tableState, editorState } = store;
  const table = getData(tableState.tables, data.tableId);
  if (
    table &&
    (editorState.focusTable === null ||
      editorState.focusTable.id !== data.tableId)
  ) {
    editorState.focusTable?.destroy();
    editorState.focusTable = new FocusTableModel(table, store);
  }
}

export function focusEndTable(): CommandEffect<null> {
  return {
    name: "editor.focusEndTable",
    data: null,
  };
}
export function focusEndTableExecute(store: Store) {
  Logger.debug("focusEndTableExecute");
  const { editorState } = store;
  editorState.focusTable?.destroy();
  editorState.focusTable = null;
  editEndTableExecute(store);
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
  focusTable?.move(data);
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

export function editEndTable(): CommandEffect<null> {
  return {
    name: "editor.editEndTable",
    data: null,
  };
}
export function editEndTableExecute(store: Store) {
  Logger.debug("editEndTableExecute");
  const { editorState } = store;
  editorState.editTable = null;
}
