import { CommandType } from './index';

export declare function hasUndoRedo(
  hasUndo: boolean,
  hasRedo: boolean
): CommandType<'editor.hasUndoRedo'>;
