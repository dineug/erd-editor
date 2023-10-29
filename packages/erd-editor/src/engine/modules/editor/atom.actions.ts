import { parser, schemaV3Parser } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';

import { query } from '@/utils/collection/query';

import { ActionMap, ActionType, ReducerType } from './actions';
import { FocusType, MoveKey, SelectType } from './state';
import { arrowDown, arrowLeft, arrowRight, arrowUp } from './utils/focus';
import {
  appendSelectColumns,
  appendSelectRangeColumns,
  selectRangeColumns,
} from './utils/selectRangeColumn';

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
  Object.keys(editor.selectedMap).forEach(id => {
    Reflect.deleteProperty(editor.selectedMap, id);
  });
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

export const focusTableAction = createAction<
  ActionMap[typeof ActionType.focusTable]
>(ActionType.focusTable);

const focusTable: ReducerType<typeof ActionType.focusTable> = (
  { editor, collections },
  { payload }
) => {
  const collection = query(collections).collection('tableEntities');

  if (editor.focusTable?.tableId === payload.tableId && payload.focusType) {
    editor.focusTable.focusType = payload.focusType;
    editor.focusTable.columnId = null;
    editor.focusTable.prevSelectColumnId = null;
    editor.focusTable.selectColumnIds = [];
  } else if (payload.focusType) {
    const table = collection.selectById(payload.tableId);
    if (!table) return;

    editor.focusTable = {
      tableId: table.id,
      focusType: payload.focusType,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
      edit: false,
    };
  } else if (editor.focusTable?.tableId !== payload.tableId) {
    const table = collection.selectById(payload.tableId);
    if (!table) return;

    editor.focusTable = {
      tableId: table.id,
      focusType: FocusType.tableName,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
      edit: false,
    };
  }
};

export const focusColumnAction = createAction<
  ActionMap[typeof ActionType.focusColumn]
>(ActionType.focusColumn);

const focusColumn: ReducerType<typeof ActionType.focusColumn> = (
  { editor, collections },
  { payload }
) => {
  const collection = query(collections).collection('tableEntities');

  if (editor.focusTable?.tableId === payload.tableId) {
    const table = collection.selectById(payload.tableId);
    if (!table) return;

    const focusTable = editor.focusTable;
    focusTable.columnId = payload.columnId;
    focusTable.focusType = payload.focusType;

    if (payload.$mod && payload.shiftKey) {
      focusTable.selectColumnIds = appendSelectRangeColumns(
        table.columnIds,
        focusTable.selectColumnIds,
        focusTable.prevSelectColumnId,
        focusTable.columnId
      );
    } else if (payload.shiftKey) {
      focusTable.selectColumnIds = selectRangeColumns(
        table.columnIds,
        focusTable.prevSelectColumnId,
        focusTable.columnId
      );
    } else if (payload.$mod) {
      focusTable.selectColumnIds = appendSelectColumns(
        focusTable.selectColumnIds,
        payload.columnId
      );
    } else {
      focusTable.selectColumnIds = [payload.columnId];
    }

    focusTable.prevSelectColumnId = payload.columnId;
  } else {
    const table = collection.selectById(payload.tableId);
    if (!table) return;

    editor.focusTable = {
      tableId: table.id,
      focusType: payload.focusType,
      columnId: payload.columnId,
      prevSelectColumnId: payload.columnId,
      selectColumnIds: [payload.columnId],
      edit: false,
    };
  }
};

export const focusTableEndAction = createAction<
  ActionMap[typeof ActionType.focusTableEnd]
>(ActionType.focusTableEnd);

const focusTableEnd: ReducerType<typeof ActionType.focusTableEnd> = ({
  editor,
}) => {
  editor.focusTable = null;
};

export const focusMoveTableAction = createAction<
  ActionMap[typeof ActionType.focusMoveTable]
>(ActionType.focusMoveTable);

const focusMoveTable: ReducerType<typeof ActionType.focusMoveTable> = (
  state,
  { payload }
) => {
  const {
    editor: { focusTable },
  } = state;
  if (!focusTable) return;
  focusTable.edit = false;

  switch (payload.moveKey) {
    case MoveKey.ArrowUp:
      arrowUp(state, payload);
      break;
    case MoveKey.ArrowDown:
      arrowDown(state, payload);
      break;
    case MoveKey.ArrowLeft:
      arrowLeft(state, payload);
      break;
    case MoveKey.ArrowRight:
      arrowRight(state, payload);
      break;
    case MoveKey.Tab:
      payload.shiftKey ? arrowLeft(state, payload) : arrowRight(state, payload);
      break;
  }
};

export const editTableAction = createAction<
  ActionMap[typeof ActionType.editTable]
>(ActionType.editTable);

const editTable: ReducerType<typeof ActionType.editTable> = ({
  editor: { focusTable },
}) => {
  if (!focusTable) return;
  focusTable.edit = true;
};

export const editTableEndAction = createAction<
  ActionMap[typeof ActionType.editTableEnd]
>(ActionType.editTableEnd);

const editTableEnd: ReducerType<typeof ActionType.editTableEnd> = ({
  editor: { focusTable },
}) => {
  if (!focusTable) return;
  focusTable.edit = false;
};

export const selectAllColumnAction = createAction<
  ActionMap[typeof ActionType.selectAllColumn]
>(ActionType.selectAllColumn);

const selectAllColumn: ReducerType<typeof ActionType.selectAllColumn> = ({
  collections,
  editor: { focusTable },
}) => {
  if (!focusTable) return;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return;

  focusTable.selectColumnIds = [...table.columnIds];
};

export const editorReducers = {
  [ActionType.changeHasHistory]: changeHasHistory,
  [ActionType.selectAll]: selectAll,
  [ActionType.unselectAll]: unselectAll,
  [ActionType.select]: select,
  [ActionType.changeViewport]: changeViewport,
  [ActionType.clear]: clear,
  [ActionType.loadJson]: loadJson,
  [ActionType.focusTable]: focusTable,
  [ActionType.focusColumn]: focusColumn,
  [ActionType.focusTableEnd]: focusTableEnd,
  [ActionType.focusMoveTable]: focusMoveTable,
  [ActionType.editTable]: editTable,
  [ActionType.editTableEnd]: editTableEnd,
  [ActionType.selectAllColumn]: selectAllColumn,
};

export const actions = {
  changeHasHistoryAction,
  selectAllAction,
  unselectAllAction,
  selectAction,
  changeViewportAction,
  clearAction,
  loadJsonAction,
  focusTableAction,
  focusColumnAction,
  focusTableEndAction,
  focusMoveTableAction,
  editTableAction,
  editTableEndAction,
  selectAllColumnAction,
};
