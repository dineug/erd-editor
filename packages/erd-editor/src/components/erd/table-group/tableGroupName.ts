import { openTableGroupNameEditor } from '@/components/erd/canvas/table-group/tableGroupNameEditor';
import { GeneratorAction } from '@/engine/generator.actions';
import type { RxStore } from '@/engine/rx-store';

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
