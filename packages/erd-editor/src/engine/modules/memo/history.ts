import { first, groupBy, last, pick } from 'lodash-es';

import { PushStreamHistory, PushUndoHistory } from '@/engine/history.actions';
import { query } from '@/utils/collection/query';

import { ActionType } from './actions';
import {
  addMemoAction,
  changeMemoColorAction,
  changeMemoValueAction,
  moveMemoAction,
  moveToMemoAction,
  removeMemoAction,
  resizeMemoAction,
} from './atom.actions';

const MOVE_MIN = 20;

const addMemo: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof addMemoAction>
) => {
  undoActions.push(removeMemoAction({ id }));
};

const removeMemo: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof removeMemoAction>,
  { collections }
) => {
  const memo = query(collections).collection('memoEntities').selectById(id);
  if (!memo) return;

  undoActions.push(
    addMemoAction({ id: memo.id, ui: pick(memo.ui, ['x', 'y', 'zIndex']) })
  );
};

const changeMemoValue: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeMemoValueAction>,
  { collections }
) => {
  const memo = query(collections).collection('memoEntities').selectById(id);
  if (!memo) return;

  undoActions.push(changeMemoValueAction({ id, value: memo.value }));
};

const moveToMemo: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof moveToMemoAction>,
  { collections }
) => {
  const memo = query(collections).collection('memoEntities').selectById(id);
  if (!memo) return;

  undoActions.push(
    moveToMemoAction({
      id,
      x: memo.ui.x,
      y: memo.ui.y,
    })
  );
};

export const memoPushUndoHistoryMap = {
  [ActionType.addMemo]: addMemo,
  [ActionType.removeMemo]: removeMemo,
  [ActionType.changeMemoValue]: changeMemoValue,
  [ActionType.moveToMemo]: moveToMemo,
};

const moveMemo: PushStreamHistory = (undoActions, redoActions, actions) => {
  const moveMemoActions: Array<ReturnType<typeof moveMemoAction>> =
    actions.filter(action => action.type === moveMemoAction.type);
  if (!moveMemoActions.length) return;

  const {
    payload: { ids },
  } = first(moveMemoActions) as ReturnType<typeof moveMemoAction>;

  let accX = 0;
  let accY = 0;

  for (const {
    payload: { movementX, movementY },
  } of moveMemoActions) {
    accX += movementX;
    accY += movementY;
  }

  if (Math.abs(accX) + Math.abs(accY) < MOVE_MIN) return;

  undoActions.push(
    moveMemoAction({
      ids,
      movementX: -1 * accX,
      movementY: -1 * accY,
    })
  );
  redoActions.push(
    moveMemoAction({
      ids,
      movementX: accX,
      movementY: accY,
    })
  );
};

const changeMemoColor: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const changeMemoColorActions: Array<
    ReturnType<typeof changeMemoColorAction>
  > = actions.filter(({ type }) => type === changeMemoColorAction.type);
  if (!changeMemoColorActions.length) return;

  const group = groupBy(changeMemoColorActions, action => action.payload.id);

  for (const [id, actions] of Object.entries(group)) {
    const firstAction = first(actions) as ReturnType<
      typeof changeMemoColorAction
    >;
    const lastAction = last(actions) as ReturnType<
      typeof changeMemoColorAction
    >;

    undoActions.push(
      changeMemoColorAction({
        id,
        color: firstAction.payload.prevColor,
        prevColor: lastAction.payload.color,
      })
    );
    redoActions.push(
      changeMemoColorAction({
        id,
        color: lastAction.payload.color,
        prevColor: firstAction.payload.prevColor,
      })
    );
  }
};

const resizeMemo: PushStreamHistory = (undoActions, redoActions, actions) => {
  const resizeMemoActions: Array<ReturnType<typeof resizeMemoAction>> =
    actions.filter(action => action.type === resizeMemoAction.type);
  if (resizeMemoActions.length < 2) return;

  undoActions.push(first(resizeMemoActions)!);
  redoActions.push(last(resizeMemoActions)!);
};

export const memoPushStreamHistoryMap = {
  [ActionType.moveMemo]: moveMemo,
  [ActionType.changeMemoColor]: changeMemoColor,
  [ActionType.resizeMemo]: resizeMemo,
};
