import { AnyAction } from '@dineug/r-html';
import { cloneDeep, isString } from 'es-toolkit';

import { Command, History } from '@/engine/history';
import { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { toDomainTypeActions } from '@/engine/modules/dictionary/domainTypes';
import {
  dictionaryPushUndoHistoryMap,
  reverseDictionaryListings,
} from '@/engine/modules/dictionary/history';
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
import {
  tableGroupPushStreamHistoryMap,
  tableGroupPushUndoHistoryMap,
} from '@/engine/modules/table-group/history';
import { RootState } from '@/engine/state';
import { Store } from '@/engine/store';
import { safeCallback } from '@/utils/safeCallback';

export type PushUndoHistory = (
  undoActions: AnyAction[],
  action: AnyAction,
  state: RootState
) => void;

export type PushStreamHistory = (
  undoActions: AnyAction[],
  redoActions: AnyAction[],
  actions: AnyAction[]
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
  ...tableGroupPushUndoHistoryMap,
  ...dictionaryPushUndoHistoryMap,
};

export const pushStreamHistoryMap: Record<string, PushStreamHistory> = {
  ...tablePushStreamHistoryMap,
  ...memoPushStreamHistoryMap,
  ...settingsPushStreamHistoryMap,
  ...tableGroupPushStreamHistoryMap,
};

function push(store: Store, history: History, actions: AnyAction[]) {
  const undoActions: AnyAction[] = [];
  const redoActions: AnyAction[] = [];

  for (const action of actions) {
    const pushUndoHistory = pushUndoHistoryMap[action.type];
    if (!pushUndoHistory) continue;

    pushUndoHistory(undoActions, action, store.state);
    redoActions.push(cloneDeep(action));
  }

  reverseDictionaryListings(undoActions);

  for (const key of Object.keys(pushStreamHistoryMap)) {
    pushStreamHistoryMap[key](undoActions, redoActions, actions);
  }

  if (!undoActions.length || !redoActions.length) return;

  history.push({
    undo: (dispatch, getNextVersion) => {
      dispatch(undoActions.map(cloneAction(getNextVersion())));
    },
    redo: (dispatch, getNextVersion) => {
      dispatch(redoActions.map(cloneAction(getNextVersion())));
    },
  });
}

function cloneAction(version: number) {
  return (action: AnyAction) => ({
    ...cloneDeep(action),
    version,
  });
}

export const pushHistory =
  (store: Store, history: History) => (actions: AnyAction[]) => {
    safeCallback(push, store, history, actions);
  };

/** Whether an action writes a dictionary row, the actions a sheet's history holds. */
export const isDictionaryAction = ({ type }: AnyAction) =>
  type.startsWith('dictionary.');

/** The data type each domain row of these actions writes, by the row's id. */
function domainTypesOf(actions: ReadonlyArray<AnyAction>) {
  const domainTypes = new Map<string, string>();
  for (const { payload } of actions.filter(isDictionaryAction)) {
    const dataType = payload?.values?.dataType;
    if (payload?.kind === DictionaryKind.domain && isString(dataType)) {
      domainTypes.set(payload.id, dataType);
    }
  }
  return domainTypes;
}

/**
 * Replays a sheet entry's row actions with the column writes the domain types
 * they set call for in the document as it stands at the replay, so a column
 * linked elsewhere or typed by hand since the entry keeps what it holds now.
 */
const replayRows =
  (store: Store, rows: AnyAction[]): Command[keyof Command] =>
  (dispatch, getNextVersion) => {
    const columns = toDomainTypeActions(store.state, {
      domainTypes: domainTypesOf(rows),
    });
    dispatch([...rows, ...columns].map(cloneAction(getNextVersion())));
  };

function pushSheet(store: Store, history: History, actions: AnyAction[]) {
  const rows = actions.filter(isDictionaryAction);
  const undoActions: AnyAction[] = [];
  const redoActions: AnyAction[] = [];

  for (const action of rows) {
    const pushUndoHistory = pushUndoHistoryMap[action.type];
    if (!pushUndoHistory) continue;

    pushUndoHistory(undoActions, action, store.state);
    redoActions.push(cloneDeep(action));
  }

  reverseDictionaryListings(undoActions);
  if (!undoActions.length || !redoActions.length) return;

  history.push({
    undo: replayRows(store, undoActions),
    redo: replayRows(store, redoActions),
  });
}

/**
 * Pushes a Dictionary tab batch onto its sheet's history: its row actions
 * alone, the column writes a domain's type spread to recomputed at each replay
 * rather than replayed as they stood at the push.
 */
export const pushSheetHistory =
  (store: Store, history: History) => (actions: AnyAction[]) => {
    safeCallback(pushSheet, store, history, actions);
  };
