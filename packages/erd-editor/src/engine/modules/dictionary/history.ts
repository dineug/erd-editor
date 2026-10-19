import { AnyAction } from '@dineug/r-html';

import { PushUndoHistory } from '@/engine/history.actions';
import { RootState } from '@/engine/state';

import { ActionMap, ActionType } from './actions';
import {
  addDictionaryAction,
  dictionaryEntries,
  dictionaryIds,
  hasDictionaryKind,
  removeDictionaryAction,
  selectDictionaryRow,
  updateDictionaryAction,
} from './atom.actions';
import { isListed } from './membership';

/**
 * Puts back the values the row held before the batch in each field the action
 * writes, as an update; nothing when it writes none or no row is held.
 */
function pushPreviousValues(
  undoActions: AnyAction[],
  { kind, id, values }: ActionMap[typeof ActionType.addDictionary],
  state: RootState
) {
  const entity = selectDictionaryRow(state, kind, id);
  const fields = dictionaryEntries(kind, values);
  if (!entity || !fields.length) return;

  undoActions.push(
    updateDictionaryAction({
      kind,
      id,
      values: Object.fromEntries(
        fields.map(([field]) => [field, Reflect.get(entity, field)])
      ),
    } as ActionMap[typeof ActionType.updateDictionary])
  );
}

/**
 * Undoes an add with a remove. An add landing on a row already listed lists
 * nothing, so its undo puts back the values it wrote instead.
 */
const addDictionary: PushUndoHistory = (
  undoActions,
  { payload }: ReturnType<typeof addDictionaryAction>,
  state
) => {
  const { kind, id } = payload;
  if (!hasDictionaryKind(kind)) return;

  if (isListed(dictionaryIds(state, kind), id)) {
    pushPreviousValues(undoActions, payload, state);
    return;
  }

  undoActions.push(removeDictionaryAction({ kind, id }));
};

/**
 * Undoes a remove with an add carrying no values: the row lists again with
 * the values its registers hold, so a peer's edit meanwhile stays.
 */
const removeDictionary: PushUndoHistory = (
  undoActions,
  { payload: { kind, id } }: ReturnType<typeof removeDictionaryAction>,
  state
) => {
  if (!hasDictionaryKind(kind)) return;
  if (!isListed(dictionaryIds(state, kind), id)) return;

  undoActions.push(addDictionaryAction({ kind, id }));
};

/** Undoes an update with the values the row held before the batch. */
const updateDictionary: PushUndoHistory = (
  undoActions,
  { payload }: ReturnType<typeof updateDictionaryAction>,
  state
) => {
  if (!hasDictionaryKind(payload.kind)) return;

  pushPreviousValues(undoActions, payload, state);
};

export const dictionaryPushUndoHistoryMap = {
  [ActionType.addDictionary]: addDictionary,
  [ActionType.updateDictionary]: updateDictionary,
  [ActionType.removeDictionary]: removeDictionary,
};
