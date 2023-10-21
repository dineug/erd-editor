import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { round } from 'lodash-es';

import { createMemo } from '@/utils/collection/memo.entity';
import { query } from '@/utils/collection/query';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addMemoAction = createAction<ActionMap[typeof ActionType.addMemo]>(
  ActionType.addMemo
);

const addMemo: ReducerType<typeof ActionType.addMemo> = (
  { doc, collections, lww },
  { payload: { id, ui }, timestamp }
) => {
  const memo = createMemo({ id });
  Object.assign(memo.ui, ui);

  query(collections)
    .collection('memoEntities')
    .addOne(memo)
    .addOperator(lww, timestamp, id, () => {
      if (!arrayHas(doc.memoIds)(id)) {
        doc.memoIds.push(id);
      }
    });
};

export const moveMemoAction = createAction<
  ActionMap[typeof ActionType.moveMemo]
>(ActionType.moveMemo);

const moveMemo: ReducerType<typeof ActionType.moveMemo> = (
  { collections },
  { payload: { ids, movementX, movementY } }
) => {
  const collection = query(collections).collection('memoEntities');
  for (const id of ids) {
    collection.getOrCreate(id, id => createMemo({ id }));
  }

  collection.updateMany(ids, memo => {
    memo.ui.x = round(memo.ui.x + movementX, 4);
    memo.ui.y = round(memo.ui.y + movementY, 4);
  });
};

export const removeMemoAction = createAction<
  ActionMap[typeof ActionType.removeMemo]
>(ActionType.removeMemo);

const removeMemo: ReducerType<typeof ActionType.removeMemo> = (
  { doc, collections, lww },
  { payload: { id }, timestamp }
) => {
  query(collections)
    .collection('memoEntities')
    .removeOperator(lww, timestamp, id, () => {
      const index = doc.memoIds.indexOf(id);
      if (index !== -1) {
        doc.memoIds.splice(index, 1);
      }
    });
};

export const changeMemoValueAction = createAction<
  ActionMap[typeof ActionType.changeMemoValue]
>(ActionType.changeMemoValue);

const changeMemoValue: ReducerType<typeof ActionType.changeMemoValue> = (
  { collections, lww },
  { payload: { id, value }, timestamp }
) => {
  const collection = query(collections).collection('memoEntities');
  collection.getOrCreate(id, id => createMemo({ id }));

  collection.replaceOperator(lww, timestamp, id, 'value', () => {
    collection.updateOne(id, memo => {
      memo.value = value;
    });
  });
};

export const changeMemoColorAction = createAction<
  ActionMap[typeof ActionType.changeMemoColor]
>(ActionType.changeMemoColor);

const changeMemoColor: ReducerType<typeof ActionType.changeMemoColor> = (
  { collections },
  { payload: { ids, color } }
) => {
  const collection = query(collections).collection('memoEntities');
  for (const id of ids) {
    collection.getOrCreate(id, id => createMemo({ id }));
  }

  collection.updateMany(ids, memo => {
    memo.ui.color = color;
  });
};

export const resizeMemoAction = createAction<
  ActionMap[typeof ActionType.resizeMemo]
>(ActionType.resizeMemo);

const resizeMemo: ReducerType<typeof ActionType.resizeMemo> = (
  { collections },
  { payload: { id, x, y, width, height } }
) => {
  const collection = query(collections).collection('memoEntities');
  collection.getOrCreate(id, id => createMemo({ id }));

  collection.updateOne(id, memo => {
    memo.ui.x = x;
    memo.ui.y = y;
    memo.ui.width = width;
    memo.ui.height = height;
  });
};

export const memoReducers = {
  [ActionType.addMemo]: addMemo,
  [ActionType.moveMemo]: moveMemo,
  [ActionType.removeMemo]: removeMemo,
  [ActionType.changeMemoValue]: changeMemoValue,
  [ActionType.changeMemoColor]: changeMemoColor,
  [ActionType.resizeMemo]: resizeMemo,
};

export const actions = {
  addMemoAction,
  moveMemoAction,
  removeMemoAction,
  changeMemoValueAction,
  changeMemoColorAction,
  resizeMemoAction,
};
