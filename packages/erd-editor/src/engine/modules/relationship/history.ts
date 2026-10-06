import { query } from '@dineug/erd-editor-schema';
import { pick } from 'es-toolkit';

import { PushUndoHistory } from '@/engine/history.actions';

import { ActionType } from './actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
  changeRelationshipTypeAction,
  namesOtherTables,
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

/**
 * Undoes with the lists the relationship holds before the batch, copied, and
 * records nothing for a payload the reducer ignores, whose undo would only
 * write the present lists over a later edit.
 */
const changeRelationshipColumns: PushUndoHistory = (
  undoActions,
  {
    payload: { id, start, end },
  }: ReturnType<typeof changeRelationshipColumnsAction>,
  { collections }
) => {
  const relationship = query(collections)
    .collection('relationshipEntities')
    .selectById(id);
  if (!relationship || namesOtherTables(relationship, { start, end })) return;

  undoActions.push(
    changeRelationshipColumnsAction({
      id,
      start: {
        tableId: relationship.start.tableId,
        columnIds: [...relationship.start.columnIds],
      },
      end: {
        tableId: relationship.end.tableId,
        columnIds: [...relationship.end.columnIds],
      },
    })
  );
};

export const relationshipPushUndoHistoryMap = {
  [ActionType.addRelationship]: addRelationship,
  [ActionType.removeRelationship]: removeRelationship,
  [ActionType.changeRelationshipType]: changeRelationshipType,
  [ActionType.changeRelationshipOnDelete]: changeRelationshipOnDelete,
  [ActionType.changeRelationshipOnUpdate]: changeRelationshipOnUpdate,
  [ActionType.changeRelationshipColumns]: changeRelationshipColumns,
};
