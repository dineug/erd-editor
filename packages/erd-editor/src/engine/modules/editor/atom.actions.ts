import {
  addOperator,
  parser,
  query,
  removeOperator,
  replaceOperator,
  schemaV3Parser,
} from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { isNil, isString, noop } from 'es-toolkit';
import { isEmpty, round } from 'es-toolkit/compat';

import { CanvasType } from '@/constants/schema';
import {
  getOpeningOrigin,
  hasViewport,
  landLoadedSettings,
  rememberCanvasType,
} from '@/engine/modules/settings/atom.actions';
import { settleDocument } from '@/engine/settle';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import { toScenePoint } from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import { hasCanvasType } from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';
import { FocusType, MoveKey, SelectType } from './state';
import { arrowDown, arrowLeft, arrowRight, arrowUp } from './utils/focus';
import {
  appendSelectColumns,
  appendSelectRangeColumns,
  selectRangeColumns,
} from './utils/selectRangeColumn';
import { clearViews, viewActions, viewReducers } from './view.actions';

const SHARED_MOUSE_TRACKER_TIMEOUT = 1000 * 30;
export const SHARED_FOCUS_TRACKER_TIMEOUT = 1000 * 90;
export const SHARED_DRAG_SELECT_TRACKER_TIMEOUT = 1000 * 3;

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

/**
 * The screen the canvas is looking through. A load that found no screen left
 * its origin waiting, and the first frame that reports one lands it in the
 * content's own travel; every other resize moves nothing, wherever the origin stands.
 */
const changeViewport: ReducerType<typeof ActionType.changeViewport> = (
  state,
  { payload: { width, height } }
) => {
  state.editor.viewport.width = width;
  state.editor.viewport.height = height;

  if (state.editor.scrollPullPending) {
    pullScrollIntoRange(state);
  }
};

export const clearAction = createAction<ActionMap[typeof ActionType.clear]>(
  ActionType.clear
);

const clear: ReducerType<typeof ActionType.clear> = state => {
  const { doc, collections } = schemaV3Parser({});
  state.doc = doc;
  state.collections = collections;
  state.editor.scrollPullPending = false;
  clearViews(state.editor);
};

/**
 * The origin a loaded document carries, kept while it draws any of the content
 * and otherwise pulled to where a screen's worth of it is, so the file opens on
 * what it holds rather than on empty canvas. An unmeasured frame waits for one.
 */
function pullScrollIntoRange(state: RootState) {
  const { settings, editor } = state;

  if (!hasViewport(editor.viewport)) {
    editor.scrollPullPending = true;
    return;
  }

  const origin = getOpeningOrigin(state);

  settings.originX = round(origin.x, 4);
  settings.originY = round(origin.y, 4);
  editor.scrollPullPending = false;
}

export const loadJsonAction = createAction<
  ActionMap[typeof ActionType.loadJson]
>(ActionType.loadJson);

/**
 * Replaces the document while it is open, an import, an undo or a peer's load,
 * the screen of every locked setting staying the reader's own. The registers
 * stay, since the session goes on: a peer's older edit is still refused.
 */
const loadJson: ReducerType<typeof ActionType.loadJson> = (
  state,
  { payload: { value }, version: actionVersion },
  ctx
) => {
  const { version, settings, doc, collections } = parser(value);
  if (!hasCanvasType(settings.canvasType)) {
    settings.canvasType = CanvasType.ERD;
  }

  rememberCanvasType(state);
  landLoadedSettings(state, settings, actionVersion ?? ctx.clock.getVersion());
  state.version = version;
  state.doc = doc;
  state.collections = collections;
  rememberCanvasType(state);
  clearViews(state.editor);
  settleDocument(state, ctx);
  pullScrollIntoRange(state);
};

export const initialClearAction = createAction<
  ActionMap[typeof ActionType.initialClear]
>(ActionType.initialClear);

const initialClear: ReducerType<typeof ActionType.initialClear> = state => {
  const { doc, collections } = schemaV3Parser({});
  state.doc = doc;
  state.collections = collections;
  state.editor.scrollPullPending = false;
  clearViews(state.editor);
};

export const initialLoadJsonAction = createAction<
  ActionMap[typeof ActionType.initialLoadJson]
>(ActionType.initialLoadJson);

/**
 * Opens a document: the file's settings, and no register of the document held
 * before, whose versions would refuse the edits of peers that opened the file
 * afresh. A store already sharing asks its peers for theirs again.
 */
const initialLoadJson: ReducerType<typeof ActionType.initialLoadJson> = (
  state,
  { payload: { value } },
  ctx
) => {
  const { version, settings, doc, collections } = parser(value);
  if (!hasCanvasType(settings.canvasType)) {
    settings.canvasType = CanvasType.ERD;
  }

  rememberCanvasType(state);
  Object.assign(state.settings, settings);
  state.version = version;
  state.doc = doc;
  state.collections = collections;
  state.lww = {};
  rememberCanvasType(state);
  clearViews(state.editor);
  settleDocument(state, ctx);
  pullScrollIntoRange(state);
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

export const editMemoAction = createAction<
  ActionMap[typeof ActionType.editMemo]
>(ActionType.editMemo);

const editMemo: ReducerType<typeof ActionType.editMemo> = (
  { editor },
  { payload: { id } }
) => {
  editor.editMemoId = id;
};

export const editMemoEndAction = createAction<
  ActionMap[typeof ActionType.editMemoEnd]
>(ActionType.editMemoEnd);

const editMemoEnd: ReducerType<typeof ActionType.editMemoEnd> = ({
  editor,
}) => {
  editor.editMemoId = null;
};

export const editTableGroupAction = createAction<
  ActionMap[typeof ActionType.editTableGroup]
>(ActionType.editTableGroup);

const editTableGroup: ReducerType<typeof ActionType.editTableGroup> = (
  { editor },
  { payload: { id } }
) => {
  editor.editTableGroupId = id;
};

export const editTableGroupEndAction = createAction<
  ActionMap[typeof ActionType.editTableGroupEnd]
>(ActionType.editTableGroupEnd);

const editTableGroupEnd: ReducerType<typeof ActionType.editTableGroupEnd> = ({
  editor,
}) => {
  editor.editTableGroupId = null;
};

export const scrollMemoAction = createAction<
  ActionMap[typeof ActionType.scrollMemo]
>(ActionType.scrollMemo);

/**
 * Only the floor is held here. The ceiling is what the fold overruns the box
 * by, which takes the leading the scene lays a body out with, so the scene
 * clamps what it reads rather than the store what it keeps.
 */
const scrollMemo: ReducerType<typeof ActionType.scrollMemo> = (
  { editor },
  { payload: { id, scrollTop } }
) => {
  editor.memoScrollTopMap[id] = Number.isFinite(scrollTop)
    ? Math.max(0, scrollTop)
    : 0;
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

export const drawStartRelationshipAction = createAction<
  ActionMap[typeof ActionType.drawStartRelationship]
>(ActionType.drawStartRelationship);

const drawStartRelationship: ReducerType<
  typeof ActionType.drawStartRelationship
> = ({ editor }, { payload: { relationshipType } }) => {
  editor.drawRelationship = {
    relationshipType,
    start: null,
    end: { x: 0, y: 0 },
  };
  editor.drawTableGroup = false;
};

export const drawStartAddRelationshipAction = createAction<
  ActionMap[typeof ActionType.drawStartAddRelationship]
>(ActionType.drawStartAddRelationship);

const drawStartAddRelationship: ReducerType<
  typeof ActionType.drawStartAddRelationship
> = (
  { editor: { drawRelationship }, collections },
  { payload: { tableId } }
) => {
  if (!drawRelationship) return;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(tableId);
  if (!table) return;

  drawRelationship.start = {
    tableId,
    x: table.ui.x,
    y: table.ui.y,
  };
};

export const drawEndRelationshipAction = createAction<
  ActionMap[typeof ActionType.drawEndRelationship]
>(ActionType.drawEndRelationship);

const drawEndRelationship: ReducerType<
  typeof ActionType.drawEndRelationship
> = ({ editor }) => {
  editor.drawRelationship = null;
};

export const drawRelationshipAction = createAction<
  ActionMap[typeof ActionType.drawRelationship]
>(ActionType.drawRelationship);

const drawRelationship: ReducerType<typeof ActionType.drawRelationship> = (
  { editor: { drawRelationship }, settings },
  { payload: { x, y } }
) => {
  if (!drawRelationship?.start) return;

  const scenePoint = toScenePoint(settings, { x, y });

  drawRelationship.end.x = scenePoint.x;
  drawRelationship.end.y = scenePoint.y;
};

export const hoverColumnMapAction = createAction<
  ActionMap[typeof ActionType.hoverColumnMap]
>(ActionType.hoverColumnMap);

const hoverColumnMap: ReducerType<typeof ActionType.hoverColumnMap> = (
  { editor },
  { payload: { columnIds } }
) => {
  Object.keys(editor.hoverColumnMap).forEach(id => {
    Reflect.deleteProperty(editor.hoverColumnMap, id);
  });

  for (const id of columnIds) {
    editor.hoverColumnMap[id] = true;
  }
};

export const hoverRelationshipMapAction = createAction<
  ActionMap[typeof ActionType.hoverRelationshipMap]
>(ActionType.hoverRelationshipMap);

const hoverRelationshipMap: ReducerType<
  typeof ActionType.hoverRelationshipMap
> = ({ editor }, { payload: { relationshipIds } }) => {
  Object.keys(editor.hoverRelationshipMap).forEach(id => {
    Reflect.deleteProperty(editor.hoverRelationshipMap, id);
  });

  for (const id of relationshipIds) {
    editor.hoverRelationshipMap[id] = true;
  }
};

export const changeOpenMapAction = createAction<
  ActionMap[typeof ActionType.changeOpenMap]
>(ActionType.changeOpenMap);

const changeOpenMap: ReducerType<typeof ActionType.changeOpenMap> = (
  { editor },
  { payload }
) => {
  Object.assign(editor.openMap, payload);
};

export const changeHandToolAction = createAction<
  ActionMap[typeof ActionType.changeHandTool]
>(ActionType.changeHandTool);

/**
 * The tool a press on the canvas is read as. Drawing a relationship or a table
 * group is another thing the same press can mean, so taking the hand up ends a
 * draw that was still running rather than leaving two modes armed at once.
 */
const changeHandTool: ReducerType<typeof ActionType.changeHandTool> = (
  { editor },
  { payload: { value } }
) => {
  editor.handTool = value;
  if (value) {
    editor.drawRelationship = null;
    editor.drawTableGroup = false;
  }
};

export const changeDrawTableGroupAction = createAction<
  ActionMap[typeof ActionType.changeDrawTableGroup]
>(ActionType.changeDrawTableGroup);

/**
 * Arms or ends the table group draw mode. Armed, it puts the hand down and ends
 * a relationship draw, so the press it waits for means one thing alone.
 */
const changeDrawTableGroup: ReducerType<
  typeof ActionType.changeDrawTableGroup
> = ({ editor }, { payload: { value } }) => {
  editor.drawTableGroup = value;
  if (value) {
    editor.handTool = false;
    editor.drawRelationship = null;
  }
};

export const changeZenModeAction = createAction<
  ActionMap[typeof ActionType.changeZenMode]
>(ActionType.changeZenMode);

const changeZenMode: ReducerType<typeof ActionType.changeZenMode> = (
  { editor },
  { payload: { value } }
) => {
  editor.zenMode = value;
};

export const dragstartColumnAction = createAction<
  ActionMap[typeof ActionType.dragstartColumn]
>(ActionType.dragstartColumn);

const dragstartColumn: ReducerType<typeof ActionType.dragstartColumn> = (
  { editor },
  { payload }
) => {
  editor.draggableColumn = payload;
  payload.columnIds.forEach(id => {
    editor.draggingColumnMap[id] = true;
  });
};

export const dragendColumnAction = createAction<
  ActionMap[typeof ActionType.dragendColumn]
>(ActionType.dragendColumn);

const dragendColumn: ReducerType<typeof ActionType.dragendColumn> = ({
  editor,
}) => {
  editor.draggableColumn = null;
  Object.keys(editor.draggingColumnMap).forEach(id => {
    Reflect.deleteProperty(editor.draggingColumnMap, id);
  });
};

export const sharedMouseTrackerAction = createAction<
  ActionMap[typeof ActionType.sharedMouseTracker]
>(ActionType.sharedMouseTracker);

const sharedMouseTracker: ReducerType<typeof ActionType.sharedMouseTracker> = (
  { editor },
  { payload, tags, meta }
) => {
  if (
    isNil(tags) ||
    !bHas(tags, Tag.shared) ||
    !isString(meta?.editorId) ||
    editor.id === meta.editorId
  ) {
    return;
  }

  const sharedMouseTracker = editor.sharedMouseTrackerMap[meta.editorId];
  const nickname =
    !isString(meta.nickname) || isEmpty(meta.nickname.trim())
      ? 'user'
      : meta.nickname.trim();

  if (sharedMouseTracker) {
    sharedMouseTracker.x = payload.x;
    sharedMouseTracker.y = payload.y;
    sharedMouseTracker.nickname = nickname;

    clearTimeout(sharedMouseTracker.timeoutId);
    sharedMouseTracker.timeoutId = setTimeout(() => {
      Reflect.deleteProperty(editor.sharedMouseTrackerMap, meta.editorId);
    }, SHARED_MOUSE_TRACKER_TIMEOUT);
  } else {
    editor.sharedMouseTrackerMap[meta.editorId] = {
      ...payload,
      id: meta.editorId,
      nickname,
      timeoutId: setTimeout(() => {
        Reflect.deleteProperty(editor.sharedMouseTrackerMap, meta.editorId);
      }, SHARED_MOUSE_TRACKER_TIMEOUT),
    };
  }
};

export const sharedFocusTrackerAction = createAction<
  ActionMap[typeof ActionType.sharedFocusTracker]
>(ActionType.sharedFocusTracker);

const sharedFocusTracker: ReducerType<typeof ActionType.sharedFocusTracker> = (
  { editor },
  { payload: { focus }, tags, meta }
) => {
  if (
    isNil(tags) ||
    !bHas(tags, Tag.shared) ||
    !isString(meta?.editorId) ||
    editor.id === meta.editorId
  ) {
    return;
  }

  const sharedFocusTracker = editor.sharedFocusTrackerMap[meta.editorId];

  if (!focus) {
    if (sharedFocusTracker) {
      clearTimeout(sharedFocusTracker.timeoutId);
      Reflect.deleteProperty(editor.sharedFocusTrackerMap, meta.editorId);
    }
    return;
  }

  if (sharedFocusTracker) {
    sharedFocusTracker.tableId = focus.tableId;
    sharedFocusTracker.columnId = focus.columnId;
    sharedFocusTracker.focusType = focus.focusType;

    clearTimeout(sharedFocusTracker.timeoutId);
    sharedFocusTracker.timeoutId = setTimeout(() => {
      Reflect.deleteProperty(editor.sharedFocusTrackerMap, meta.editorId);
    }, SHARED_FOCUS_TRACKER_TIMEOUT);
  } else {
    editor.sharedFocusTrackerMap[meta.editorId] = {
      ...focus,
      id: meta.editorId,
      timeoutId: setTimeout(() => {
        Reflect.deleteProperty(editor.sharedFocusTrackerMap, meta.editorId);
      }, SHARED_FOCUS_TRACKER_TIMEOUT),
    };
  }
};

export const sharedSelectionTrackerAction = createAction<
  ActionMap[typeof ActionType.sharedSelectionTracker]
>(ActionType.sharedSelectionTracker);

const sharedSelectionTracker: ReducerType<
  typeof ActionType.sharedSelectionTracker
> = ({ editor }, { payload: { selectedIds }, tags, meta }) => {
  if (
    isNil(tags) ||
    !bHas(tags, Tag.shared) ||
    !isString(meta?.editorId) ||
    editor.id === meta.editorId
  ) {
    return;
  }

  const sharedSelectionTracker =
    editor.sharedSelectionTrackerMap[meta.editorId];

  if (!selectedIds.length) {
    if (sharedSelectionTracker) {
      clearTimeout(sharedSelectionTracker.timeoutId);
      Reflect.deleteProperty(editor.sharedSelectionTrackerMap, meta.editorId);
    }
    return;
  }

  if (sharedSelectionTracker) {
    sharedSelectionTracker.selectedIds = selectedIds;

    clearTimeout(sharedSelectionTracker.timeoutId);
    sharedSelectionTracker.timeoutId = setTimeout(() => {
      Reflect.deleteProperty(editor.sharedSelectionTrackerMap, meta.editorId);
    }, SHARED_FOCUS_TRACKER_TIMEOUT);
  } else {
    editor.sharedSelectionTrackerMap[meta.editorId] = {
      id: meta.editorId,
      selectedIds,
      timeoutId: setTimeout(() => {
        Reflect.deleteProperty(editor.sharedSelectionTrackerMap, meta.editorId);
      }, SHARED_FOCUS_TRACKER_TIMEOUT),
    };
  }
};

export const sharedDragSelectTrackerAction = createAction<
  ActionMap[typeof ActionType.sharedDragSelectTracker]
>(ActionType.sharedDragSelectTracker);

const sharedDragSelectTracker: ReducerType<
  typeof ActionType.sharedDragSelectTracker
> = ({ editor }, { payload: { rect }, tags, meta }) => {
  if (
    isNil(tags) ||
    !bHas(tags, Tag.shared) ||
    !isString(meta?.editorId) ||
    editor.id === meta.editorId
  ) {
    return;
  }

  const sharedDragSelectTracker =
    editor.sharedDragSelectTrackerMap[meta.editorId];

  if (!rect) {
    if (sharedDragSelectTracker) {
      clearTimeout(sharedDragSelectTracker.timeoutId);
      Reflect.deleteProperty(editor.sharedDragSelectTrackerMap, meta.editorId);
    }
    return;
  }

  if (sharedDragSelectTracker) {
    sharedDragSelectTracker.x = rect.x;
    sharedDragSelectTracker.y = rect.y;
    sharedDragSelectTracker.w = rect.w;
    sharedDragSelectTracker.h = rect.h;

    clearTimeout(sharedDragSelectTracker.timeoutId);
    sharedDragSelectTracker.timeoutId = setTimeout(() => {
      Reflect.deleteProperty(editor.sharedDragSelectTrackerMap, meta.editorId);
    }, SHARED_DRAG_SELECT_TRACKER_TIMEOUT);
  } else {
    editor.sharedDragSelectTrackerMap[meta.editorId] = {
      ...rect,
      id: meta.editorId,
      timeoutId: setTimeout(() => {
        Reflect.deleteProperty(
          editor.sharedDragSelectTrackerMap,
          meta.editorId
        );
      }, SHARED_DRAG_SELECT_TRACKER_TIMEOUT),
    };
  }
};

export const dragSelectRectAction = createAction<
  ActionMap[typeof ActionType.dragSelectRect]
>(ActionType.dragSelectRect);

const dragSelectRect: ReducerType<typeof ActionType.dragSelectRect> = (
  { editor },
  { payload: { rect } }
) => {
  editor.dragSelect = rect;
};

export const getLWWAction = createAction<ActionMap[typeof ActionType.getLWW]>(
  ActionType.getLWW
);

const getLWW: ReducerType<typeof ActionType.getLWW> = noop;

export const mergeLWWAction = createAction<
  ActionMap[typeof ActionType.mergeLWW]
>(ActionType.mergeLWW);

const mergeLWW: ReducerType<typeof ActionType.mergeLWW> = (
  { lww },
  { payload: { lww: remoteLWW } }
) => {
  Object.entries(remoteLWW).forEach(
    ([id, [tag, addVersion, removeVersion, replaceRecord]]) => {
      addOperator(lww, addVersion, id, tag, noop);
      removeOperator(lww, removeVersion, id, tag, noop);

      Object.entries(replaceRecord).forEach(([path, replaceVersion]) => {
        replaceOperator(lww, replaceVersion, id, tag, path, noop);
      });
    }
  );
};

export const editorReducers = {
  [ActionType.changeHasHistory]: changeHasHistory,
  [ActionType.selectAll]: selectAll,
  [ActionType.unselectAll]: unselectAll,
  [ActionType.select]: select,
  [ActionType.changeViewport]: changeViewport,
  [ActionType.clear]: clear,
  [ActionType.loadJson]: loadJson,
  [ActionType.initialClear]: initialClear,
  [ActionType.initialLoadJson]: initialLoadJson,
  [ActionType.focusTable]: focusTable,
  [ActionType.focusColumn]: focusColumn,
  [ActionType.focusTableEnd]: focusTableEnd,
  [ActionType.focusMoveTable]: focusMoveTable,
  [ActionType.editTable]: editTable,
  [ActionType.editTableEnd]: editTableEnd,
  [ActionType.editMemo]: editMemo,
  [ActionType.editMemoEnd]: editMemoEnd,
  [ActionType.editTableGroup]: editTableGroup,
  [ActionType.editTableGroupEnd]: editTableGroupEnd,
  [ActionType.scrollMemo]: scrollMemo,
  [ActionType.selectAllColumn]: selectAllColumn,
  [ActionType.drawStartRelationship]: drawStartRelationship,
  [ActionType.drawStartAddRelationship]: drawStartAddRelationship,
  [ActionType.drawEndRelationship]: drawEndRelationship,
  [ActionType.drawRelationship]: drawRelationship,
  [ActionType.hoverColumnMap]: hoverColumnMap,
  [ActionType.hoverRelationshipMap]: hoverRelationshipMap,
  [ActionType.changeOpenMap]: changeOpenMap,
  [ActionType.changeHandTool]: changeHandTool,
  [ActionType.changeDrawTableGroup]: changeDrawTableGroup,
  [ActionType.changeZenMode]: changeZenMode,
  [ActionType.dragstartColumn]: dragstartColumn,
  [ActionType.dragendColumn]: dragendColumn,
  [ActionType.sharedMouseTracker]: sharedMouseTracker,
  [ActionType.sharedFocusTracker]: sharedFocusTracker,
  [ActionType.sharedSelectionTracker]: sharedSelectionTracker,
  [ActionType.sharedDragSelectTracker]: sharedDragSelectTracker,
  [ActionType.dragSelectRect]: dragSelectRect,
  [ActionType.getLWW]: getLWW,
  [ActionType.mergeLWW]: mergeLWW,
  ...viewReducers,
};

export const actions = {
  changeHasHistoryAction,
  selectAllAction,
  unselectAllAction,
  selectAction,
  changeViewportAction,
  clearAction,
  loadJsonAction,
  initialClearAction,
  initialLoadJsonAction,
  focusTableAction,
  focusColumnAction,
  focusTableEndAction,
  focusMoveTableAction,
  editTableAction,
  editTableEndAction,
  editMemoAction,
  editMemoEndAction,
  editTableGroupAction,
  editTableGroupEndAction,
  scrollMemoAction,
  selectAllColumnAction,
  drawStartRelationshipAction,
  drawStartAddRelationshipAction,
  drawEndRelationshipAction,
  drawRelationshipAction,
  hoverColumnMapAction,
  hoverRelationshipMapAction,
  changeOpenMapAction,
  changeHandToolAction,
  changeDrawTableGroupAction,
  changeZenModeAction,
  dragstartColumnAction,
  dragendColumnAction,
  sharedMouseTrackerAction,
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
  sharedDragSelectTrackerAction,
  dragSelectRectAction,
  getLWWAction,
  mergeLWWAction,
  ...viewActions,
};
