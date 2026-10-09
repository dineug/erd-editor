import { query } from '@dineug/erd-editor-schema';
import { groupBy, head, last } from 'es-toolkit';

import { PushStreamHistory, PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
  moveTableGroupAction,
  moveToTableGroupAction,
  removeTableGroupAction,
  resizeTableGroupAction,
} from './atom.actions';

const MOVE_MIN = 20;

const addTableGroup: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof addTableGroupAction>
) => {
  undoActions.push(removeTableGroupAction({ id }));
};

const removeTableGroup: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof removeTableGroupAction>,
  { collections }
) => {
  const group = query(collections)
    .collection('tableGroupEntities')
    .selectById(id);
  if (!group) return;

  undoActions.push(
    addTableGroupAction({
      id: group.id,
      color: group.color,
      ui: { ...group.ui },
    })
  );
};

const changeTableGroupName: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeTableGroupNameAction>,
  { collections }
) => {
  const group = query(collections)
    .collection('tableGroupEntities')
    .selectById(id);
  if (!group) return;

  undoActions.push(changeTableGroupNameAction({ id, value: group.name }));
};

const moveToTableGroup: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof moveToTableGroupAction>,
  { collections }
) => {
  const group = query(collections)
    .collection('tableGroupEntities')
    .selectById(id);
  if (!group) return;

  undoActions.push(
    moveToTableGroupAction({ id, x: group.ui.x, y: group.ui.y })
  );
};

export const tableGroupPushUndoHistoryMap = {
  [ActionType.addTableGroup]: addTableGroup,
  [ActionType.removeTableGroup]: removeTableGroup,
  [ActionType.changeTableGroupName]: changeTableGroupName,
  [ActionType.moveToTableGroup]: moveToTableGroup,
};

const moveTableGroup: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const moveActions: Array<ReturnType<typeof moveTableGroupAction>> =
    actions.filter(action => action.type === moveTableGroupAction.type);
  if (!moveActions.length) return;

  const group = groupBy(moveActions, action => action.payload.ids.join(','));

  for (const [, actions] of Object.entries(group)) {
    const {
      payload: { ids },
    } = head(actions) as ReturnType<typeof moveTableGroupAction>;

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
      moveTableGroupAction({ ids, movementX: -1 * x, movementY: -1 * y })
    );
    redoActions.push(moveTableGroupAction({ ids, movementX: x, movementY: y }));
  }
};

const changeTableGroupColor: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const colorActions: Array<ReturnType<typeof changeTableGroupColorAction>> =
    actions.filter(({ type }) => type === changeTableGroupColorAction.type);
  if (!colorActions.length) return;

  const group = groupBy(colorActions, action => action.payload.id);

  for (const [id, actions] of Object.entries(group)) {
    const firstAction = head(actions) as ReturnType<
      typeof changeTableGroupColorAction
    >;
    const lastAction = last(actions) as ReturnType<
      typeof changeTableGroupColorAction
    >;

    undoActions.push(
      changeTableGroupColorAction({
        id,
        color: firstAction.payload.prevColor,
        prevColor: lastAction.payload.color,
      })
    );
    redoActions.push(
      changeTableGroupColorAction({
        id,
        color: lastAction.payload.color,
        prevColor: firstAction.payload.prevColor,
      })
    );
  }
};

const resizeTableGroup: PushStreamHistory = (
  undoActions,
  redoActions,
  actions
) => {
  const resizeActions: Array<ReturnType<typeof resizeTableGroupAction>> =
    actions.filter(action => action.type === resizeTableGroupAction.type);
  if (!resizeActions.length) return;

  const group = groupBy(resizeActions, action => action.payload.id);

  for (const [, actions] of Object.entries(group)) {
    if (actions.length < 2) continue;

    undoActions.push(
      head(actions) as ReturnType<typeof resizeTableGroupAction>
    );
    redoActions.push(
      last(actions) as ReturnType<typeof resizeTableGroupAction>
    );
  }
};

export const tableGroupPushStreamHistoryMap = {
  [ActionType.moveTableGroup]: moveTableGroup,
  [ActionType.changeTableGroupColor]: changeTableGroupColor,
  [ActionType.resizeTableGroup]: resizeTableGroup,
};
