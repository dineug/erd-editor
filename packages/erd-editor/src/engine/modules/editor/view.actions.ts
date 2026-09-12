import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { clamp } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import { Open } from '@/constants/open';
import { RootState } from '@/engine/state';
import { clearSortChannel } from '@/utils/draw-relationship';
import { zoomLevelInRange } from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';
import { Editor, SceneView, ViewKind } from './state';
import { createSceneView, getActiveView } from './view';

/** The two reaches a Focus view can be opened at. */
export const VIEW_HOP_MIN = 1;
export const VIEW_HOP_MAX = 2;

/**
 * Retires what a view session of one kind routed, so a view reopened on the
 * same centers never shows the earlier anchors on its first frame, and the
 * other kind's channel is untouched. Only this store's connectors: another editor on the page shares the channel.
 */
function clearViewGeometry({ collections }: RootState, kind: ViewKind): void {
  clearSortChannel(
    query(collections).collection('relationshipEntities').selectAll(),
    kind
  );
}

/**
 * The view a placement action writes: the kind it names, which a scene
 * dispatches for the slot it reads, else the active one, which the redirect
 * and every consumer outside a scene address.
 */
const getAimedView = (state: RootState, kind?: ViewKind): SceneView | null =>
  kind ? state.editor.views[kind] : getActiveView(state);

/**
 * Keeps the overlay flag the gates read true exactly while a Focus view is
 * up. Written here alone, beside every write of the slot, so a document
 * replaced under the overlay cannot leave the flag standing over a view that is gone.
 */
function syncFocusOpen(editor: Editor): void {
  editor.openMap[Open.focus] = editor.views.focus !== null;
}

/** Drops both views, which is what any replacement of the document owes them. */
export function clearViews(editor: Editor): void {
  editor.views.flow = null;
  editor.views.focus = null;
  syncFocusOpen(editor);
}

export const viewOpenAction = createAction<
  ActionMap[typeof ActionType.viewOpen]
>(ActionType.viewOpen);

const viewOpen: ReducerType<typeof ActionType.viewOpen> = (
  state,
  { payload: { kind, centerIds = [] } }
) => {
  clearViewGeometry(state, kind);
  state.editor.views[kind] = createSceneView(kind, centerIds);
  kind === ViewKind.focus && syncFocusOpen(state.editor);
};

export const viewCloseAction = createAction<
  ActionMap[typeof ActionType.viewClose]
>(ActionType.viewClose);

const viewClose: ReducerType<typeof ActionType.viewClose> = (
  state,
  { payload: { kind } }
) => {
  clearViewGeometry(state, kind);
  state.editor.views[kind] = null;
  kind === ViewKind.focus && syncFocusOpen(state.editor);
};

export const viewScrollToAction = createAction<
  ActionMap[typeof ActionType.viewScrollTo]
>(ActionType.viewScrollTo);

/** The view's own placement, taken as it stands, as settings.scrollTo takes the document's. */
const viewScrollTo: ReducerType<typeof ActionType.viewScrollTo> = (
  state,
  { payload: { originX, originY, kind } }
) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  view.originX = round(originX, 4);
  view.originY = round(originY, 4);
};

export const viewStreamScrollToAction = createAction<
  ActionMap[typeof ActionType.viewStreamScrollTo]
>(ActionType.viewStreamScrollTo);

const viewStreamScrollTo: ReducerType<typeof ActionType.viewStreamScrollTo> = (
  state,
  { payload: { movementX, movementY, kind } }
) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  view.originX = round(view.originX + movementX, 4);
  view.originY = round(view.originY + movementY, 4);
};

export const viewChangeZoomLevelAction = createAction<
  ActionMap[typeof ActionType.viewChangeZoomLevel]
>(ActionType.viewChangeZoomLevel);

const viewChangeZoomLevel: ReducerType<
  typeof ActionType.viewChangeZoomLevel
> = (state, { payload: { value, kind } }) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  view.zoomLevel = zoomLevelInRange(value);
};

export const viewStreamZoomLevelAction = createAction<
  ActionMap[typeof ActionType.viewStreamZoomLevel]
>(ActionType.viewStreamZoomLevel);

const viewStreamZoomLevel: ReducerType<
  typeof ActionType.viewStreamZoomLevel
> = (state, { payload: { value, kind } }) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  view.zoomLevel = zoomLevelInRange(view.zoomLevel + value);
};

export const viewMoveTableAction = createAction<
  ActionMap[typeof ActionType.viewMoveTable]
>(ActionType.viewMoveTable);

/** Moves the tables the view places; one it does not place is not drawn and has nowhere to go. */
const viewMoveTable: ReducerType<typeof ActionType.viewMoveTable> = (
  state,
  { payload: { ids, movementX, movementY, kind } }
) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  for (const id of ids) {
    const point = view.positions[id];
    if (!point) continue;

    point.x = round(point.x + movementX, 4);
    point.y = round(point.y + movementY, 4);
  }
};

export const viewSetLayoutAction = createAction<
  ActionMap[typeof ActionType.viewSetLayout]
>(ActionType.viewSetLayout);

/**
 * Lands a placement in the view it was computed for, named rather than read
 * from the active slot, since the layout arrives from a worker and a Focus
 * view may have opened over a Flow view in the meantime.
 */
const viewSetLayout: ReducerType<typeof ActionType.viewSetLayout> = (
  { editor },
  { payload: { kind, positions } }
) => {
  const view = editor.views[kind];
  if (!view) return;

  view.positions = Object.fromEntries(
    Object.entries(positions).map(([id, { x, y }]) => [id, { x, y }])
  );
};

export const viewChangeShowModeAction = createAction<
  ActionMap[typeof ActionType.viewChangeShowMode]
>(ActionType.viewChangeShowMode);

const viewChangeShowMode: ReducerType<typeof ActionType.viewChangeShowMode> = (
  state,
  { payload: { value, kind } }
) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  view.showMode = value;
};

export const viewChangeHopAction = createAction<
  ActionMap[typeof ActionType.viewChangeHop]
>(ActionType.viewChangeHop);

const viewChangeHop: ReducerType<typeof ActionType.viewChangeHop> = (
  { editor: { views } },
  { payload: { value } }
) => {
  if (!views.focus) return;

  views.focus.hop = clamp(Math.trunc(value), VIEW_HOP_MIN, VIEW_HOP_MAX);
};

export const viewSetCentersAction = createAction<
  ActionMap[typeof ActionType.viewSetCenters]
>(ActionType.viewSetCenters);

/**
 * Stands the view the kind names, else the active one, on new centers. A push
 * opens a history entry and drops the forward ones; otherwise the entry stood
 * on is rewritten, so the entry under the cursor always names the centers the view stands on.
 */
const viewSetCenters: ReducerType<typeof ActionType.viewSetCenters> = (
  state,
  { payload: { tableIds, push = false, kind } }
) => {
  const view = getAimedView(state, kind);
  if (!view) return;

  const { history } = view;
  view.centerIds = [...tableIds];

  if (push) {
    history.entries.splice(history.cursor + 1);
    history.entries.push([...tableIds]);
    history.cursor = history.entries.length - 1;
  } else {
    history.entries[history.cursor] = [...tableIds];
  }
};

export const viewHistoryMoveAction = createAction<
  ActionMap[typeof ActionType.viewHistoryMove]
>(ActionType.viewHistoryMove);

const viewHistoryMove: ReducerType<typeof ActionType.viewHistoryMove> = (
  { editor: { views } },
  { payload: { delta } }
) => {
  const view = views.focus;
  if (!view) return;

  const { history } = view;
  const cursor = history.cursor + Math.trunc(delta);
  if (cursor < 0 || cursor >= history.entries.length) return;

  history.cursor = cursor;
  view.centerIds = [...history.entries[cursor]];
};

export const changeVisualizationModeAction = createAction<
  ActionMap[typeof ActionType.changeVisualizationMode]
>(ActionType.changeVisualizationMode);

const changeVisualizationMode: ReducerType<
  typeof ActionType.changeVisualizationMode
> = ({ editor }, { payload: { value } }) => {
  editor.visualizationMode = value;
};

export const viewReducers = {
  [ActionType.viewOpen]: viewOpen,
  [ActionType.viewClose]: viewClose,
  [ActionType.viewScrollTo]: viewScrollTo,
  [ActionType.viewStreamScrollTo]: viewStreamScrollTo,
  [ActionType.viewChangeZoomLevel]: viewChangeZoomLevel,
  [ActionType.viewStreamZoomLevel]: viewStreamZoomLevel,
  [ActionType.viewMoveTable]: viewMoveTable,
  [ActionType.viewSetLayout]: viewSetLayout,
  [ActionType.viewChangeShowMode]: viewChangeShowMode,
  [ActionType.viewChangeHop]: viewChangeHop,
  [ActionType.viewSetCenters]: viewSetCenters,
  [ActionType.viewHistoryMove]: viewHistoryMove,
  [ActionType.changeVisualizationMode]: changeVisualizationMode,
};

export const viewActions = {
  viewOpenAction,
  viewCloseAction,
  viewScrollToAction,
  viewStreamScrollToAction,
  viewChangeZoomLevelAction,
  viewStreamZoomLevelAction,
  viewMoveTableAction,
  viewSetLayoutAction,
  viewChangeShowModeAction,
  viewChangeHopAction,
  viewSetCentersAction,
  viewHistoryMoveAction,
  changeVisualizationModeAction,
};
