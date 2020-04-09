import { TableFocus, FocusType } from "../model/TableFocusModel";

export interface EditorState {
  focus: boolean;
  tableFocus: TableFocus | null;
  tableEdit: TableEdit | null;
}

export interface TableEdit {
  id: string;
  focusType: FocusType;
}

export function createEditorState(): EditorState {
  return {
    focus: true,
    tableFocus: null,
    tableEdit: null,
  };
}
