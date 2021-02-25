import { State } from '@@types/engine/store';
import { HasUndoRedo } from '@@types/engine/command/editor.cmd';

export function executeHasUndoRedo({ editorState }: State, data: HasUndoRedo) {
  editorState.hasUndo = data.hasUndo;
  editorState.hasRedo = data.hasRedo;
}

export const executeEditorCommandMap = {
  'editor.hasUndoRedo': executeHasUndoRedo,
};
