import { EditorState, MoveKey } from '@@types/engine/store/editor.state';

export const createEditorState = (): EditorState => ({
  panels: [],
  hasUndo: false,
  hasRedo: false,
  focusTable: null,
});

export const moveKeys: MoveKey[] = [
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Tab',
];
