import { createCommand } from './helper';

export const hasUndoRedo = (hasUndo: boolean, hasRedo: boolean) =>
  createCommand('editor.hasUndoRedo', { hasUndo, hasRedo });
