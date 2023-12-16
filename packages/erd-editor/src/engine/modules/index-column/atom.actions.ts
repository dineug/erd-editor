import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { query } from '@/utils/collection/query';
import { addAndSort } from '@/utils/collection/sequence';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addIndexColumnAction = createAction<
  ActionMap[typeof ActionType.addIndexColumn]
>(ActionType.addIndexColumn);

const addIndexColumn: ReducerType<typeof ActionType.addIndexColumn> = (
  { collections, lww },
  { payload: { id, indexId, tableId, columnId }, timestamp }
) => {
  const indexCollection = query(collections).collection('indexEntities');
  const index = indexCollection.getOrCreate(indexId, id =>
    createIndex({ id, tableId })
  );

  query(collections)
    .collection('indexColumnEntities')
    .addOne(createIndexColumn({ id, indexId, columnId }))
    .addOperator(lww, timestamp, id, () => {
      if (!arrayHas(index.indexColumnIds)(id)) {
        indexCollection.updateOne(indexId, index => {
          addAndSort(index.indexColumnIds, index.seqIndexColumnIds, id);
        });
      }
    });
};

export const removeIndexColumnAction = createAction<
  ActionMap[typeof ActionType.removeIndexColumn]
>(ActionType.removeIndexColumn);

const removeIndexColumn: ReducerType<typeof ActionType.removeIndexColumn> = (
  { collections, lww },
  { payload: { id, indexId, tableId }, timestamp }
) => {
  const indexCollection = query(collections).collection('indexEntities');
  const index = indexCollection.getOrCreate(indexId, id =>
    createIndex({ id, tableId })
  );

  query(collections)
    .collection('indexColumnEntities')
    .removeOperator(lww, timestamp, id, () => {
      const i = index.indexColumnIds.indexOf(id);
      if (i !== -1) {
        indexCollection.updateOne(indexId, index => {
          index.indexColumnIds.splice(i, 1);
        });
      }
    });
};

export const moveIndexColumnAction = createAction<
  ActionMap[typeof ActionType.moveIndexColumn]
>(ActionType.moveIndexColumn);

const moveIndexColumn: ReducerType<typeof ActionType.moveIndexColumn> = (
  { collections },
  { payload: { id, indexId, tableId, targetId } }
) => {
  if (id === targetId) {
    return;
  }

  const indexCollection = query(collections).collection('indexEntities');
  const index = indexCollection.getOrCreate(indexId, id =>
    createIndex({ id, tableId })
  );

  const i = index.indexColumnIds.indexOf(id);
  if (i === -1) return;

  const targetIndex = index.indexColumnIds.indexOf(targetId);
  if (targetIndex === -1) return;

  indexCollection.updateOne(indexId, index => {
    index.indexColumnIds.splice(i, 1);
    index.indexColumnIds.splice(targetIndex, 0, id);

    const seqIndex = index.seqIndexColumnIds.indexOf(id);
    const seqTargetIndex = index.seqIndexColumnIds.indexOf(targetId);

    if (seqIndex !== -1 && seqTargetIndex !== -1) {
      index.seqIndexColumnIds.splice(seqIndex, 1);
      index.seqIndexColumnIds.splice(seqTargetIndex, 0, id);
    }
  });
};

export const changeIndexColumnOrderTypeAction = createAction<
  ActionMap[typeof ActionType.changeIndexColumnOrderType]
>(ActionType.changeIndexColumnOrderType);

const changeIndexColumnOrderType: ReducerType<
  typeof ActionType.changeIndexColumnOrderType
> = (
  { collections, lww },
  { payload: { id, indexId, columnId, value }, timestamp }
) => {
  const collection = query(collections).collection('indexColumnEntities');
  collection.getOrCreate(id, id =>
    createIndexColumn({ id, indexId, columnId })
  );

  collection.replaceOperator(lww, timestamp, id, 'orderType', () => {
    collection.updateOne(id, indexColumn => {
      indexColumn.orderType = value;
    });
  });
};

export const indexColumnReducers = {
  [ActionType.addIndexColumn]: addIndexColumn,
  [ActionType.removeIndexColumn]: removeIndexColumn,
  [ActionType.moveIndexColumn]: moveIndexColumn,
  [ActionType.changeIndexColumnOrderType]: changeIndexColumnOrderType,
};

export const actions = {
  addIndexColumnAction,
  removeIndexColumnAction,
  moveIndexColumnAction,
  changeIndexColumnOrderTypeAction,
};
