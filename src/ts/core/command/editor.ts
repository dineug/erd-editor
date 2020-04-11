import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import { getData } from "../Helper";
import { TableFocusModel, FocusType } from "../model/TableFocusModel";

export interface TableFocus {
  tableId: string;
}
export function tableFocus(tableId: string): CommandEffect<TableFocus> {
  return {
    name: "editor.tableFocus",
    data: {
      tableId,
    },
  };
}
export function tableFocusExecute(store: Store, data: TableFocus) {
  Logger.debug("tableFocusExecute");
  const { tableState, editorState, canvasState } = store;
  const table = getData(tableState.tables, data.tableId);
  if (
    table &&
    (editorState.tableFocus === null ||
      editorState.tableFocus.id !== data.tableId)
  ) {
    editorState.tableFocus = new TableFocusModel(table, canvasState.show);
  }
}

export function tableFocusEnd(): CommandEffect<null> {
  return {
    name: "editor.tableFocusEnd",
    data: null,
  };
}
export function tableFocusEndExecute(store: Store) {
  Logger.debug("tableFocusEndExecute");
  const { editorState } = store;
  editorState.tableFocus = null;
  tableEditEndExecute(store);
}

export const moveKeys: MoveKey[] = [
  "ArrowUp",
  "ArrowRight",
  "ArrowDown",
  "ArrowLeft",
];
export type MoveKey = "ArrowUp" | "ArrowRight" | "ArrowDown" | "ArrowLeft";
export interface TableFocusMove {
  moveKey: MoveKey;
  shiftKey: boolean;
}
export function tableFocusMove(
  moveKey: MoveKey,
  shiftKey: boolean
): CommandEffect<TableFocusMove> {
  return {
    name: "editor.tableFocusMove",
    data: {
      moveKey,
      shiftKey,
    },
  };
}
export function tableFocusMoveExecute(store: Store, data: TableFocusMove) {
  Logger.debug("tableFocusMoveExecute");
  const { tableFocus } = store.editorState;
  if (tableFocus) {
    tableFocus.move(data);
  }
}

export interface TableEdit {
  id: string;
  focusType: FocusType;
}
export function tableEdit(
  id: string,
  focusType: FocusType
): CommandEffect<TableEdit> {
  return {
    name: "editor.tableEdit",
    data: {
      id,
      focusType,
    },
  };
}
export function tableEditExecute(store: Store, data: TableEdit) {
  Logger.debug("tableEditExecute");
  const { editorState } = store;
  editorState.tableEdit = {
    id: data.id,
    focusType: data.focusType,
  };
}

export function tableEditEnd(): CommandEffect<null> {
  return {
    name: "editor.tableEditEnd",
    data: null,
  };
}
export function tableEditEndExecute(store: Store) {
  Logger.debug("tableEditEndExecute");
  const { editorState } = store;
  editorState.tableEdit = null;
}
