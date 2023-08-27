import { createAction } from '@dineug/r-html';
import { round } from 'lodash-es';

import { createMemo } from '@/utils/collection/memo.entity';
import { query } from '@/utils/collection/query';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addMemoAction = createAction<ActionMap[typeof ActionType.addMemo]>(
  ActionType.addMemo
);

const addMemo: ReducerType<typeof ActionType.addMemo> = (
  { doc, collections },
  { id, ui }
) => {
  if (!doc.memoIds.includes(id)) {
    doc.memoIds.push(id);
  }

  const memo = createMemo({ id });
  Object.assign(memo.ui, ui);
  query(collections).collection('memoEntities').addOne(memo);
};

export const moveMemoAction = createAction<
  ActionMap[typeof ActionType.moveMemo]
>(ActionType.moveMemo);

const moveMemo: ReducerType<typeof ActionType.moveMemo> = (
  { collections },
  { ids, movementX, movementY }
) => {
  const collection = query(collections).collection('memoEntities');
  for (const id of ids) {
    if (!collection.selectById(id)) {
      collection.addOne(createMemo({ id }));
    }
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
  { doc },
  { id }
) => {
  const index = doc.memoIds.indexOf(id);
  if (index !== -1) {
    doc.memoIds.splice(index, 1);
  }
};

export const changeMemoValueAction = createAction<
  ActionMap[typeof ActionType.changeMemoValue]
>(ActionType.changeMemoValue);

const changeMemoValue: ReducerType<typeof ActionType.changeMemoValue> = (
  { collections },
  { id, value }
) => {
  const collection = query(collections).collection('memoEntities');
  if (!collection.selectById(id)) {
    collection.addOne(createMemo({ id }));
  }

  collection.updateOne(id, memo => {
    memo.value = value;
  });
};

export const changeMemoColorAction = createAction<
  ActionMap[typeof ActionType.changeMemoColor]
>(ActionType.changeMemoColor);

const changeMemoColor: ReducerType<typeof ActionType.changeMemoColor> = (
  { collections },
  { ids, color }
) => {
  const collection = query(collections).collection('memoEntities');
  for (const id of ids) {
    if (!collection.selectById(id)) {
      collection.addOne(createMemo({ id }));
    }
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
  { id, x, y, width, height }
) => {
  const collection = query(collections).collection('memoEntities');
  if (!collection.selectById(id)) {
    collection.addOne(createMemo({ id }));
  }

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
