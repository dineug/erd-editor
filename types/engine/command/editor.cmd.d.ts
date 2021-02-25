export interface HasUndoRedo {
  hasUndo: boolean;
  hasRedo: boolean;
}

export interface EditorCommandMap {
  'editor.hasUndoRedo': HasUndoRedo;
}
