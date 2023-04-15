import { AnyAction } from '@dineug/r-html';
import { safeCallback } from '@dineug/shared';

import { History } from '@/engine/history';
import { Store } from '@/engine/store';

export type PushUndoHistory = (
  store: Store,
  undoActions: AnyAction[],
  action: AnyAction
) => void;

export type PushStreamHistory = (
  actions: AnyAction[],
  undoActions: AnyAction[],
  redoActions: AnyAction[]
) => void;

const pushUndoHistoryMap: Record<string, PushUndoHistory> = {};

const pushStreamHistoryMap: Record<string, PushStreamHistory> = {};

function push(store: Store, history: History, actions: AnyAction[]) {
  const undoActions: AnyAction[] = [];
  const redoActions: AnyAction[] = [];

  for (const action of actions) {
    const pushUndoHistory = pushUndoHistoryMap[action.type];
    if (!pushUndoHistory) return;

    pushUndoHistory(store, undoActions, action);
    redoActions.push(action);
  }

  for (const key of Object.keys(pushStreamHistoryMap)) {
    pushStreamHistoryMap[key](actions, undoActions, redoActions);
  }

  if (!undoActions.length || !redoActions.length) return;

  history.push({
    undo: () => store.dispatchSync(undoActions),
    redo: () => store.dispatchSync(redoActions),
  });
}

export const pushHistory =
  (store: Store, history: History) => (actions: AnyAction[]) => {
    safeCallback(push, store, history, actions);
  };
