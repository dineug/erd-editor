import { PushStreamHistory, PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  resizeAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from './atom.actions';

const MOVE_MIN = 20;

const resize: PushUndoHistory = (undoActions, _, { settings }) => {
  undoActions.push(
    resizeAction({ width: settings.width, height: settings.height })
  );
};

const scrollTo: PushUndoHistory = (undoActions, _, { settings }) => {
  undoActions.push(
    scrollToAction({
      scrollLeft: settings.scrollLeft,
      scrollTop: settings.scrollTop,
    })
  );
};

const changeShow: PushUndoHistory = (
  undoActions,
  { payload: { show, value } }: ReturnType<typeof changeShowAction>
) => {
  undoActions.push(changeShowAction({ show, value: !value }));
};

const changeZoomLevel: PushUndoHistory = (undoActions, _, { settings }) => {
  undoActions.push(changeZoomLevelAction({ value: settings.zoomLevel }));
};

export const settingsPushUndoHistoryMap = {
  [ActionType.resize]: resize,
  [ActionType.scrollTo]: scrollTo,
  [ActionType.changeShow]: changeShow,
  [ActionType.changeZoomLevel]: changeZoomLevel,
};

const streamScrollTo: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const streamScrollToActions: Array<ReturnType<typeof streamScrollToAction>> =
    actions.filter(action => action.type === streamScrollToAction.type);
  if (!streamScrollToActions.length) return;

  const { x, y } = streamScrollToActions.reduce(
    (acc, { payload: { movementX, movementY } }) => {
      acc.x += movementX;
      acc.y += movementY;
      return acc;
    },
    { x: 0, y: 0 }
  );

  if (Math.abs(x) + Math.abs(y) < MOVE_MIN) return;

  undoActions.push(
    streamScrollToAction({
      movementX: -1 * x,
      movementY: -1 * y,
    })
  );
  redoActions.push(
    streamScrollToAction({
      movementX: x,
      movementY: y,
    })
  );
};

const streamZoomLevel: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const streamZoomLevelActions: Array<
    ReturnType<typeof streamZoomLevelAction>
  > = actions.filter(action => action.type === streamZoomLevelAction.type);
  if (!streamZoomLevelActions.length) return;

  const acc = streamZoomLevelActions.reduce(
    (acc, { payload: { value } }) => acc + value,
    0
  );

  undoActions.push(streamZoomLevelAction({ value: -1 * acc }));
  redoActions.push(streamZoomLevelAction({ value: acc }));
};

export const settingsPushStreamHistoryMap = {
  [ActionType.streamScrollTo]: streamScrollTo,
  [ActionType.streamZoomLevel]: streamZoomLevel,
};
