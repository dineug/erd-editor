import { Show } from '@/constants/schema';
import { SelectType } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

const dropSelected = (state: RootState, type: SelectType) => {
  Object.entries(state.editor.selectedMap).forEach(([id, selected]) => {
    if (selected === type) {
      Reflect.deleteProperty(state.editor.selectedMap, id);
    }
  });
};

/**
 * Hidden groups take no press, so hiding them lets go of every selected group,
 * ends a draw armed and closes a name editor, none of which a reader could see
 * or end any longer.
 */
export function releaseTableGroups(state: RootState) {
  dropSelected(state, SelectType.tableGroup);
  state.editor.drawTableGroup = false;
  state.editor.editTableGroupId = null;
}

/** Hidden memos take no press either, so hiding them lets go of every selected memo and closes a memo editor. */
export function releaseMemos(state: RootState) {
  dropSelected(state, SelectType.memo);
  state.editor.editMemoId = null;
}

/**
 * Lets go of what the show bits a load landed hide, as hiding them by View
 * Option does, so an undo, an import or a peer's load that hides them leaves
 * no selection or editor on what no reader can see.
 */
export function releaseHidden(state: RootState) {
  const { show } = state.settings;
  if (bHas(show, Show.hideTableGroup)) releaseTableGroups(state);
  if (bHas(show, Show.hideMemo)) releaseMemos(state);
}
