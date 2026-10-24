import {
  editTableGroupAction,
  focusTableEndAction,
} from '@/engine/modules/editor/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import { isTableGroupShown } from '@/utils/tableGroup';

/**
 * Opens the editor over a group's title bar, the table focus let go so Enter and the arrows are the
 * name's. A readonly store opens nothing, nor do hidden groups, whose bar no editor stands over and
 * which would leave the canvas shortcuts waiting on an editor that never opened.
 *
 * @example
 * openTableGroupNameEditor(store, groupId);
 */
export function openTableGroupNameEditor(store: RxStore, id: string): void {
  if (store.getReadonly() || !isTableGroupShown(store.state)) return;
  store.dispatch(focusTableEndAction(), editTableGroupAction({ id }));
}
