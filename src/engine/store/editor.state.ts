import { EditorState } from '@@types/engine/store/editor.state';

export const createEditorState = (): EditorState => ({
  panels: [],
  hasUndo: false,
  hasRedo: false,
  focusTable: null,
});
