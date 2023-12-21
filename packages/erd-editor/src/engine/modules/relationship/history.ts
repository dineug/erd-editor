import { query } from '@dineug/erd-editor-schema';
import { pick } from 'lodash-es';

import { PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import {
  addRelationshipAction,
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

export const relationshipPushUndoHistoryMap = {
  [ActionType.addRelationship]: addRelationship,
  [ActionType.removeRelationship]: removeRelationship,
  [ActionType.changeRelationshipType]: changeRelationshipType,
};
