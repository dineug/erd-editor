import { toJson } from '@dineug/erd-editor-schema';

import { PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import { clearAction, loadJsonAction } from './atom.actions';

const loadJson: PushUndoHistory = (undoActions, _, state) => {
  undoActions.push(clearAction(), loadJsonAction({ value: toJson(state) }));
};

const clear: PushUndoHistory = (undoActions, _, state) => {
  undoActions.push(loadJsonAction({ value: toJson(state) }));
};

export const editorPushUndoHistoryMap = {
  [ActionType.loadJson]: loadJson,
  [ActionType.clear]: clear,
};
