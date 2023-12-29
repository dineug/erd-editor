import { query } from '@dineug/erd-editor-schema';
import { first, groupBy, last, pick } from 'lodash-es';

import { PushStreamHistory, PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
} from './atom.actions';

const MOVE_MIN = 20;

const addTable: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof addTableAction>
) => {
  undoActions.push(removeTableAction({ id }));
};

const removeTable: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof removeTableAction>,
  { collections }
) => {
  const table = query(collections).collection('tableEntities').selectById(id);
  if (!table) return;

  undoActions.push(
    addTableAction({ id: table.id, ui: pick(table.ui, ['x', 'y', 'zIndex']) })
  );
};

const changeTableName: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeTableNameAction>,
  { collections }
) => {
  const table = query(collections).collection('tableEntities').selectById(id);
  if (!table) return;

  undoActions.push(changeTableNameAction({ id, value: table.name }));
};

const changeTableComment: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeTableCommentAction>,
  { collections }
) => {
  const table = query(collections).collection('tableEntities').selectById(id);
  if (!table) return;

  undoActions.push(changeTableCommentAction({ id, value: table.comment }));
};

const moveToTable: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof moveToTableAction>,
  { collections }
) => {
  const table = query(collections).collection('tableEntities').selectById(id);
  if (!table) return;

  undoActions.push(
    moveToTableAction({
      id,
      x: table.ui.x,
      y: table.ui.y,
    })
  );
};

const sortTable: PushUndoHistory = () => {};

export const tablePushUndoHistoryMap = {
  [ActionType.addTable]: addTable,
  [ActionType.removeTable]: removeTable,
  [ActionType.changeTableName]: changeTableName,
  [ActionType.changeTableComment]: changeTableComment,
  [ActionType.moveToTable]: moveToTable,
  [ActionType.sortTable]: sortTable,
};

const moveTable: PushStreamHistory = (undoActions, redoActions, actions) => {
  const moveTableActions: Array<ReturnType<typeof moveTableAction>> =
    actions.filter(action => action.type === moveTableAction.type);
  if (!moveTableActions.length) return;

  const group = groupBy(moveTableActions, action =>
    action.payload.ids.join(',')
  );

  for (const [, actions] of Object.entries(group)) {
    const {
      payload: { ids },
    } = first(actions) as ReturnType<typeof moveTableAction>;

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
      moveTableAction({
        ids,
        movementX: -1 * x,
        movementY: -1 * y,
      })
    );
    redoActions.push(
      moveTableAction({
        ids,
        movementX: x,
        movementY: y,
      })
    );
  }
};

const changeTableColor: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const changeTableColorActions: Array<
    ReturnType<typeof changeTableColorAction>
  > = actions.filter(({ type }) => type === changeTableColorAction.type);
  if (!changeTableColorActions.length) return;

  const group = groupBy(changeTableColorActions, action => action.payload.id);

  for (const [id, actions] of Object.entries(group)) {
    const firstAction = first(actions) as ReturnType<
      typeof changeTableColorAction
    >;
    const lastAction = last(actions) as ReturnType<
      typeof changeTableColorAction
    >;

    undoActions.push(
      changeTableColorAction({
        id,
        color: firstAction.payload.prevColor,
        prevColor: lastAction.payload.color,
      })
    );
    redoActions.push(
      changeTableColorAction({
        id,
        color: lastAction.payload.color,
        prevColor: firstAction.payload.prevColor,
      })
    );
  }
};

export const tablePushStreamHistoryMap = {
  [ActionType.moveTable]: moveTable,
  [ActionType.changeTableColor]: changeTableColor,
};
