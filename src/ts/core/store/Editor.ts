import { FocusTable, FocusType } from "../model/FocusTableModel";

export interface EditorState {
  focus: boolean;
  focusTable: FocusTable | null;
  editTable: EditTable | null;
}

export interface EditTable {
  id: string;
  focusType: FocusType;
}

export function createEditorState(): EditorState {
  return {
    focus: true,
    focusTable: null,
    editTable: null,
  };
}
