import { query } from '@dineug/erd-editor-schema';
import { first, groupBy, last, pick } from 'lodash-es';

import { PushStreamHistory, PushUndoHistory } from '@/engine/history.actions';

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

  const group = groupBy(moveMemoActions, action =>
    action.payload.ids.join(',')
  );

  for (const [, actions] of Object.entries(group)) {
    const {
      payload: { ids },
    } = first(actions) as ReturnType<typeof moveMemoAction>;

    const { x, y } = actions.reduce(
      (acc, { payload: { movementX, movementY } }) => {
        acc.x += movementX;
        acc.y += movementY;
        return acc;
      },
      { x: 0, y: 0 }
    );

    if (Math.abs(x) + Math.abs(y) < MOVE_MIN) continue;

    undoActions.push(
      moveMemoAction({
        ids,
        movementX: -1 * x,
        movementY: -1 * y,
      })
    );
    redoActions.push(
      moveMemoAction({
        ids,
        movementX: x,
        movementY: y,
      })
    );
  }
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
  if (!resizeMemoActions.length) return;

  const group = groupBy(resizeMemoActions, action => action.payload.id);

  for (const [, actions] of Object.entries(group)) {
    if (actions.length < 2) continue;

    const firstAction = first(actions) as ReturnType<typeof resizeMemoAction>;
    const lastAction = last(actions) as ReturnType<typeof resizeMemoAction>;

    undoActions.push(firstAction);
    redoActions.push(lastAction);
  }
};

export const memoPushStreamHistoryMap = {
  [ActionType.moveMemo]: moveMemo,
  [ActionType.changeMemoColor]: changeMemoColor,
  [ActionType.resizeMemo]: resizeMemo,
};
