import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { createIndex } from '@/utils/collection/index.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addIndexAction = createAction<
  ActionMap[typeof ActionType.addIndex]
>(ActionType.addIndex);

const addIndex: ReducerType<typeof ActionType.addIndex> = (
  { doc, collections, lww },
  { payload: { id, tableId }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('indexEntities')
    .addOne(createIndex({ id, tableId }))
    .addOperator(lww, safeVersion, id, () => {
      if (!arrayHas(doc.indexIds)(id)) {
        doc.indexIds.push(id);
      }
    });
};

export const removeIndexAction = createAction<
  ActionMap[typeof ActionType.removeIndex]
>(ActionType.removeIndex);

const removeIndex: ReducerType<typeof ActionType.removeIndex> = (
  { doc, collections, lww },
  { payload: { id }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('indexEntities')
    .removeOperator(lww, safeVersion, id, () => {
      const index = doc.indexIds.indexOf(id);
      if (index !== -1) {
        doc.indexIds.splice(index, 1);
      }
    });
};

export const changeIndexNameAction = createAction<
  ActionMap[typeof ActionType.changeIndexName]
>(ActionType.changeIndexName);

const changeIndexName: ReducerType<typeof ActionType.changeIndexName> = (
  { collections, lww },
  { payload: { id, tableId, value }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('indexEntities');
  collection.getOrCreate(id, id => createIndex({ id, tableId }));

  collection.replaceOperator(lww, safeVersion, id, 'name', () => {
    collection.updateOne(id, index => {
      index.name = value;
    });
  });
};

export const changeIndexUniqueAction = createAction<
  ActionMap[typeof ActionType.changeIndexUnique]
>(ActionType.changeIndexUnique);

const changeIndexUnique: ReducerType<typeof ActionType.changeIndexUnique> = (
  { collections, lww },
  { payload: { id, tableId, value }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('indexEntities');
  collection.getOrCreate(id, id => createIndex({ id, tableId }));

  collection.replaceOperator(lww, safeVersion, id, 'unique', () => {
    collection.updateOne(id, index => {
      index.unique = value;
    });
  });
};

export const indexReducers = {
  [ActionType.addIndex]: addIndex,
  [ActionType.removeIndex]: removeIndex,
  [ActionType.changeIndexName]: changeIndexName,
  [ActionType.changeIndexUnique]: changeIndexUnique,
};

export const actions = {
  addIndexAction,
  removeIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
};
