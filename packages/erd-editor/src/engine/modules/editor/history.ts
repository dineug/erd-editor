import { toJson } from '@dineug/erd-editor-schema';

import { PushUndoHistory } from '@/engine/history.actions';
import { RootState } from '@/engine/state';

import { ActionType } from './actions';
import { clearAction, keepsDictionaries, loadJsonAction } from './atom.actions';

/**
 * The load an undo puts the document back with. Under the flag it keeps the
 * store's words and terms, so the text leaves them out; the domains stay in,
 * since the parser clears each column's link to a domain the text lacks.
 */
function toUndoLoad(state: RootState, keep: boolean) {
  if (!keep) return loadJsonAction({ value: toJson(state) });

  const value = toJson({
    ...state,
    doc: { ...state.doc, wordIds: [], termIds: [] },
    collections: { ...state.collections, wordEntities: {}, termEntities: {} },
  });
  return loadJsonAction({ value, keepDictionaries: true });
}

const loadJson: PushUndoHistory = (undoActions, { payload }, state) => {
  const keep = keepsDictionaries(payload);

  undoActions.push(
    clearAction(keep ? { keepDictionaries: true } : undefined),
    toUndoLoad(state, keep)
  );
};

const clear: PushUndoHistory = (undoActions, { payload }, state) => {
  undoActions.push(toUndoLoad(state, keepsDictionaries(payload)));
};

export const editorPushUndoHistoryMap = {
  [ActionType.loadJson]: loadJson,
  [ActionType.clear]: clear,
};
