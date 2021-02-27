import { MoveKey } from '@@types/engine/store/editor.state';
import { focusMoveTable } from './editor.cmd.helper';

export function* focusMoveTable$(moveKey: MoveKey, shiftKey: boolean) {
  yield focusMoveTable(moveKey, shiftKey);
}
