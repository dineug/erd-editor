import { CommandType } from './index';
import { MoveKey } from '../store/editor.state';

export declare function focusMoveTable$(
  moveKey: MoveKey,
  shiftKey: boolean
): Generator<CommandType<'editor.focusMoveTable'>>;
