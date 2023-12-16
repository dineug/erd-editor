import { AnyAction } from '@dineug/r-html';
import { safeCallback } from '@dineug/shared';
import { cloneDeep } from 'lodash-es';

import { History } from '@/engine/history';
import { editorPushUndoHistoryMap } from '@/engine/modules/editor/history';
import { indexPushUndoHistoryMap } from '@/engine/modules/index/history';
import { indexColumnPushUndoHistoryMap } from '@/engine/modules/index-column/history';
import {
  memoPushStreamHistoryMap,
  memoPushUndoHistoryMap,
} from '@/engine/modules/memo/history';
import { relationshipPushUndoHistoryMap } from '@/engine/modules/relationship/history';
import {
  settingsPushStreamHistoryMap,
  settingsPushUndoHistoryMap,
} from '@/engine/modules/settings/history';
import {
  tablePushStreamHistoryMap,
  tablePushUndoHistoryMap,
} from '@/engine/modules/table/history';
import { tableColumnPushUndoHistoryMap } from '@/engine/modules/table-column/history';
import { RootState } from '@/engine/state';
import { Store } from '@/engine/store';

export type PushUndoHistory = (
  undoActions: AnyAction[],
  action: AnyAction,
  state: RootState
) => void;

export type PushStreamHistory = (
  undoActions: AnyAction[],
  redoActions: AnyAction[],
  actions: AnyAction[],
  state: RootState
) => void;

export const pushUndoHistoryMap: Record<string, PushUndoHistory> = {
  ...tablePushUndoHistoryMap,
  ...tableColumnPushUndoHistoryMap,
  ...relationshipPushUndoHistoryMap,
  ...memoPushUndoHistoryMap,
  ...settingsPushUndoHistoryMap,
  ...editorPushUndoHistoryMap,
  ...indexPushUndoHistoryMap,
  ...indexColumnPushUndoHistoryMap,
};

export const pushStreamHistoryMap: Record<string, PushStreamHistory> = {
  ...tablePushStreamHistoryMap,
  ...memoPushStreamHistoryMap,
  ...settingsPushStreamHistoryMap,
};

function push(store: Store, history: History, actions: AnyAction[]) {
  const undoActions: AnyAction[] = [];
  const redoActions: AnyAction[] = [];

  for (const action of actions) {
    const pushUndoHistory = pushUndoHistoryMap[action.type];
    if (!pushUndoHistory) continue;

    pushUndoHistory(undoActions, action, store.state);
    redoActions.push(action);
  }

  for (const key of Object.keys(pushStreamHistoryMap)) {
    pushStreamHistoryMap[key](undoActions, redoActions, actions, store.state);
  }

  if (!undoActions.length || !redoActions.length) return;

  history.push({
    undo: () => {
      const timestamp = Date.now();
      store.dispatchSync(undoActions.map(cloneAction(timestamp)));
    },
    redo: () => {
      const timestamp = Date.now();
      store.dispatchSync(redoActions.map(cloneAction(timestamp)));
    },
  });
}

function cloneAction(timestamp: number) {
  return (action: AnyAction) => ({
    ...cloneDeep(action),
    timestamp,
  });
}

export const pushHistory =
  (store: Store, history: History) => (actions: AnyAction[]) => {
    safeCallback(push, store, history, actions);
  };
