import { FocusTable, FocusType } from "../model/FocusTableModel";
import { DraggableColumn } from "../command/editor";

export interface EditorState {
  focus: boolean;
  focusTable: FocusTable | null;
  editTable: EditTable | null;
  draggableColumn: DraggableColumn | null;
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
    draggableColumn: null,
  };
}
