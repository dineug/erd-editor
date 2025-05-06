import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { createRelationship } from '@/utils/collection/relationship.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addRelationshipAction = createAction<
  ActionMap[typeof ActionType.addRelationship]
>(ActionType.addRelationship);

const addRelationship: ReducerType<typeof ActionType.addRelationship> = (
  { doc, collections, lww },
  { payload: { id, relationshipType, start, end }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('relationshipEntities')
    .addOne(
      createRelationship({
        id,
        relationshipType,
        start: {
          tableId: start.tableId,
          columnIds: start.columnIds,
        },
        end: {
          tableId: end.tableId,
          columnIds: end.columnIds,
        },
      })
    )
    .addOperator(lww, safeVersion, id, () => {
      if (!arrayHas(doc.relationshipIds)(id)) {
        doc.relationshipIds.push(id);
      }
    });
};

export const removeRelationshipAction = createAction<
  ActionMap[typeof ActionType.removeRelationship]
>(ActionType.removeRelationship);

const removeRelationship: ReducerType<typeof ActionType.removeRelationship> = (
  { doc, collections, lww },
  { payload: { id }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('relationshipEntities')
    .removeOperator(lww, safeVersion, id, () => {
      const index = doc.relationshipIds.indexOf(id);
      if (index !== -1) {
        doc.relationshipIds.splice(index, 1);
      }
    });
};

export const changeRelationshipTypeAction = createAction<
  ActionMap[typeof ActionType.changeRelationshipType]
>(ActionType.changeRelationshipType);

const changeRelationshipType: ReducerType<
  typeof ActionType.changeRelationshipType
> = ({ collections, lww }, { payload: { id, value }, version }, { clock }) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('relationshipEntities');

  collection.replaceOperator(lww, safeVersion, id, 'relationshipType', () => {
    collection.updateOne(id, relationship => {
      relationship.relationshipType = value;
    });
  });
};

export const relationshipReducers = {
  [ActionType.addRelationship]: addRelationship,
  [ActionType.removeRelationship]: removeRelationship,
  [ActionType.changeRelationshipType]: changeRelationshipType,
};

export const actions = {
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipTypeAction,
};
