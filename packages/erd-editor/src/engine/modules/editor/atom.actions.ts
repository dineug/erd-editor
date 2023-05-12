import { createAction } from '@dineug/r-html';

import { ActionMap, ActionType, ReducerType } from './actions';

export const changeHasHistoryAction = createAction<
  ActionMap[typeof ActionType.changeHasHistory]
>(ActionType.changeHasHistory);

const changeHasHistory: ReducerType<typeof ActionType.changeHasHistory> = (
  { editor },
  { hasRedo, hasUndo }
) => {
  editor.hasRedo = hasRedo;
  editor.hasUndo = hasUndo;
};

export const editorReducers = {
  [ActionType.changeHasHistory]: changeHasHistory,
};

export const actions = {
  changeHasHistoryAction,
};
