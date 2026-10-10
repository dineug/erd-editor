import { GeneratorAction } from '@/engine/generator.actions';
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

/**
 * Adds a group through the batch given and opens its name editor, so a name
 * can be typed at once. The group is the one id the batch adds to the
 * document, and nothing opens when it adds none.
 *
 * @example
 * addTableGroupAndRename(store, addTableGroupFromTablesAction$());
 */
export function addTableGroupAndRename(
  store: RxStore,
  action: GeneratorAction
): void {
  const before = new Set(store.state.doc.tableGroupIds);
  store.dispatchSync(action);

  const id = store.state.doc.tableGroupIds.find(id => !before.has(id));
  if (id) openTableGroupNameEditor(store, id);
}
