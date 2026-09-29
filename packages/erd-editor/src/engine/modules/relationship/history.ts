import { query } from '@dineug/erd-editor-schema';
import { pick } from 'es-toolkit';

import { PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import {
  addRelationshipAction,
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from './atom.actions';

const addRelationship: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof addRelationshipAction>
) => {
  undoActions.push(removeRelationshipAction({ id }));
};

const removeRelationship: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof removeRelationshipAction>,
  { collections }
) => {
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(id);
  if (!relationship) return;

  undoActions.push(
    addRelationshipAction({
      id: relationship.id,
      relationshipType: relationship.relationshipType,
      onDelete: relationship.onDelete,
      onUpdate: relationship.onUpdate,
      start: pick(relationship.start, ['tableId', 'columnIds']),
      end: pick(relationship.end, ['tableId', 'columnIds']),
    })
  );
};

const changeRelationshipType: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeRelationshipTypeAction>,
  { collections }
) => {
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(id);
  if (!relationship) return;

  undoActions.push(
    changeRelationshipTypeAction({
      id,
      value: relationship.relationshipType,
    })
  );
};

const changeRelationshipOnDelete: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeRelationshipOnDeleteAction>,
  { collections }
) => {
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(id);
  if (!relationship) return;

  undoActions.push(
    changeRelationshipOnDeleteAction({
      id,
      value: relationship.onDelete,
    })
  );
};

const changeRelationshipOnUpdate: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof changeRelationshipOnUpdateAction>,
  { collections }
) => {
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(id);
  if (!relationship) return;

  undoActions.push(
    changeRelationshipOnUpdateAction({
      id,
      value: relationship.onUpdate,
    })
  );
};

export const relationshipPushUndoHistoryMap = {
  [ActionType.addRelationship]: addRelationship,
  [ActionType.removeRelationship]: removeRelationship,
  [ActionType.changeRelationshipType]: changeRelationshipType,
  [ActionType.changeRelationshipOnDelete]: changeRelationshipOnDelete,
  [ActionType.changeRelationshipOnUpdate]: changeRelationshipOnUpdate,
};
