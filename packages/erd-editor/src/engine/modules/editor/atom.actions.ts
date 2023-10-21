import { parser, schemaV3Parser } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';

import { ActionMap, ActionType, ReducerType } from './actions';
import { SelectType } from './state';

export const changeHasHistoryAction = createAction<
  ActionMap[typeof ActionType.changeHasHistory]
>(ActionType.changeHasHistory);

const changeHasHistory: ReducerType<typeof ActionType.changeHasHistory> = (
  { editor },
  { payload: { hasRedo, hasUndo } }
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

const select: ReducerType<typeof ActionType.select> = (
  { editor },
  { payload }
) => {
  Object.assign(editor.selectedMap, payload);
};

export const changeViewportAction = createAction<
  ActionMap[typeof ActionType.changeViewport]
>(ActionType.changeViewport);

const changeViewport: ReducerType<typeof ActionType.changeViewport> = (
  { editor },
  { payload: { width, height } }
) => {
  editor.viewport.width = width;
  editor.viewport.height = height;
};

export const clearAction = createAction<ActionMap[typeof ActionType.clear]>(
  ActionType.clear
);

const clear: ReducerType<typeof ActionType.clear> = state => {
  const { doc, collections, lww } = schemaV3Parser({});
  state.doc = doc;
  state.collections = collections;
  state.lww = lww;
};

export const loadJsonAction = createAction<
  ActionMap[typeof ActionType.loadJson]
>(ActionType.loadJson);

const loadJson: ReducerType<typeof ActionType.loadJson> = (
  state,
  { payload: { value } }
) => {
  const { version, settings, doc, collections, lww } = parser(value);
  state.version = version;
  state.settings = settings;
  state.doc = doc;
  state.collections = collections;
  state.lww = lww;
};

export const editorReducers = {
  [ActionType.changeHasHistory]: changeHasHistory,
  [ActionType.selectAll]: selectAll,
  [ActionType.unselectAll]: unselectAll,
  [ActionType.select]: select,
  [ActionType.changeViewport]: changeViewport,
  [ActionType.clear]: clear,
  [ActionType.loadJson]: loadJson,
};

export const actions = {
  changeHasHistoryAction,
  selectAllAction,
  unselectAllAction,
  selectAction,
  changeViewportAction,
  clearAction,
  loadJsonAction,
};
