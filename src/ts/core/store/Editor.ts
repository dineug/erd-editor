export interface EditorState {
  focus: boolean;
}

export function createEditorState(): EditorState {
  return {
    focus: true,
  };
}
