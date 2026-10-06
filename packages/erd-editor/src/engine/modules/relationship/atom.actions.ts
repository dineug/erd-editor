import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';

import { ReferentialAction } from '@/constants/schema';
import { arrayHas } from '@/utils/arrayHas';
import { createRelationship } from '@/utils/collection/relationship.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addRelationshipAction = createAction<
  ActionMap[typeof ActionType.addRelationship]
>(ActionType.addRelationship);

const addRelationship: ReducerType<typeof ActionType.addRelationship> = (
  { doc, collections, lww },
  {
    payload: { id, relationshipType, onDelete, onUpdate, start, end },
    version,
  },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('relationshipEntities')
    .addOne(
      createRelationship({
        id,
        relationshipType,
        onDelete: onDelete ?? ReferentialAction.none,
        onUpdate: onUpdate ?? ReferentialAction.none,
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

export const changeRelationshipOnDeleteAction = createAction<
  ActionMap[typeof ActionType.changeRelationshipOnDelete]
>(ActionType.changeRelationshipOnDelete);

const changeRelationshipOnDelete: ReducerType<
  typeof ActionType.changeRelationshipOnDelete
> = ({ collections, lww }, { payload: { id, value }, version }, { clock }) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('relationshipEntities');

  collection.replaceOperator(lww, safeVersion, id, 'onDelete', () => {
    collection.updateOne(id, relationship => {
      relationship.onDelete = value;
    });
  });
};

export const changeRelationshipOnUpdateAction = createAction<
  ActionMap[typeof ActionType.changeRelationshipOnUpdate]
>(ActionType.changeRelationshipOnUpdate);

const changeRelationshipOnUpdate: ReducerType<
  typeof ActionType.changeRelationshipOnUpdate
> = ({ collections, lww }, { payload: { id, value }, version }, { clock }) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('relationshipEntities');

  collection.replaceOperator(lww, safeVersion, id, 'onUpdate', () => {
    collection.updateOne(id, relationship => {
      relationship.onUpdate = value;
    });
  });
};

export const changeRelationshipColumnsAction = createAction<
  ActionMap[typeof ActionType.changeRelationshipColumns]
>(ActionType.changeRelationshipColumns);

const COLUMNS = 'columns';

const toColumnsKey = (startColumnIds: string[], endColumnIds: string[]) =>
  JSON.stringify([startColumnIds, endColumnIds]);

/**
 * Both ends share the one register, so a mapping never mixes two writers. A
 * payload naming other tables than the entity's is ignored before the register
 * moves, and of two writes at one version the greater JSON of the lists wins.
 */
const changeRelationshipColumns: ReducerType<
  typeof ActionType.changeRelationshipColumns
> = (
  { collections, lww },
  { payload: { id, start, end }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('relationshipEntities');
  const relationship = collection.selectById(id);

  if (
    relationship &&
    (relationship.start.tableId !== start.tableId ||
      relationship.end.tableId !== end.tableId)
  ) {
    return;
  }

  if (
    relationship &&
    (lww[id]?.[3][COLUMNS] ?? -1) === safeVersion &&
    toColumnsKey(start.columnIds, end.columnIds) <=
      toColumnsKey(relationship.start.columnIds, relationship.end.columnIds)
  ) {
    return;
  }

  // New arrays, so the lists an undo entry captured from the entity stay put.
  collection.replaceOperator(lww, safeVersion, id, COLUMNS, () => {
    collection.updateOne(id, value => {
      value.start.columnIds = [...start.columnIds];
      value.end.columnIds = [...end.columnIds];
    });
  });
};

export const relationshipReducers = {
  [ActionType.addRelationship]: addRelationship,
  [ActionType.removeRelationship]: removeRelationship,
  [ActionType.changeRelationshipType]: changeRelationshipType,
  [ActionType.changeRelationshipOnDelete]: changeRelationshipOnDelete,
  [ActionType.changeRelationshipOnUpdate]: changeRelationshipOnUpdate,
  [ActionType.changeRelationshipColumns]: changeRelationshipColumns,
};

export const actions = {
  addRelationshipAction,
  removeRelationshipAction,
  changeRelationshipTypeAction,
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
  changeRelationshipColumnsAction,
};
