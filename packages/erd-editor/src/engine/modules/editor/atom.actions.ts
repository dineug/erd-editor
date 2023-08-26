import { createAction } from '@dineug/r-html';

import { ActionMap, ActionType, ReducerType } from './actions';
import { SelectType } from './state';

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

export const selectAllAction = createAction<
  ActionMap[typeof ActionType.selectAll]
>(ActionType.selectAll);

const selectAll: ReducerType<typeof ActionType.selectAll> = ({
  editor,
  doc,
}) => {
  const tableSelectedMap = doc.tableIds.reduce<Record<string, SelectType>>(
    (acc, id) => {
      acc[id] = SelectType.table;
      return acc;
    },
    {}
  );
  const memoSelectedMap = doc.memoIds.reduce<Record<string, SelectType>>(
    (acc, id) => {
      acc[id] = SelectType.memo;
      return acc;
    },
    {}
  );

  editor.selectedMap = {
    ...memoSelectedMap,
    ...tableSelectedMap,
  };
};

export const unselectAllAction = createAction<
  ActionMap[typeof ActionType.unselectAll]
>(ActionType.unselectAll);

const unselectAll: ReducerType<typeof ActionType.unselectAll> = ({
  editor,
}) => {
  editor.selectedMap = {};
};

export const selectAction = createAction<ActionMap[typeof ActionType.select]>(
  ActionType.select
);

const select: ReducerType<typeof ActionType.select> = ({ editor }, payload) => {
  Object.assign(editor.selectedMap, payload);
};

export const editorReducers = {
  [ActionType.changeHasHistory]: changeHasHistory,
  [ActionType.selectAll]: selectAll,
  [ActionType.unselectAll]: unselectAll,
  [ActionType.select]: select,
};

export const actions = {
  changeHasHistoryAction,
  selectAllAction,
  unselectAllAction,
  selectAction,
};
