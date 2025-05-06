import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { round } from 'lodash-es';

import { createMemo } from '@/utils/collection/memo.entity';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addMemoAction = createAction<ActionMap[typeof ActionType.addMemo]>(
  ActionType.addMemo
);

const addMemo: ReducerType<typeof ActionType.addMemo> = (
  { doc, collections, lww },
  { payload: { id, ui }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('memoEntities')
    .addOne(createMemo({ id, ui }))
    .addOperator(lww, safeVersion, id, () => {
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

export const moveToMemoAction = createAction<
  ActionMap[typeof ActionType.moveToMemo]
>(ActionType.moveToMemo);

const moveToMemo: ReducerType<typeof ActionType.moveToMemo> = (
  { collections },
  { payload: { id, x, y } }
) => {
  const collection = query(collections).collection('memoEntities');
  collection.getOrCreate(id, id => createMemo({ id }));

  collection.updateOne(id, memo => {
    memo.ui.x = x;
    memo.ui.y = y;
  });
};

export const removeMemoAction = createAction<
  ActionMap[typeof ActionType.removeMemo]
>(ActionType.removeMemo);

const removeMemo: ReducerType<typeof ActionType.removeMemo> = (
  { doc, collections, lww },
  { payload: { id }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('memoEntities')
    .removeOperator(lww, safeVersion, id, () => {
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
  { payload: { id, value }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('memoEntities');
  collection.getOrCreate(id, id => createMemo({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'value', () => {
    collection.updateOne(id, memo => {
      memo.value = value;
    });
  });
};

export const changeMemoColorAction = createAction<
  ActionMap[typeof ActionType.changeMemoColor]
>(ActionType.changeMemoColor);

const changeMemoColor: ReducerType<typeof ActionType.changeMemoColor> = (
  { collections, lww },
  { payload: { id, color }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('memoEntities');
  collection.getOrCreate(id, id => createMemo({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'ui.color', () => {
    collection.updateOne(id, memo => {
      memo.ui.color = color;
    });
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

export const changeZIndexAction = createAction<
  ActionMap[typeof ActionType.changeZIndex]
>(ActionType.changeZIndex);

const changeZIndex: ReducerType<typeof ActionType.changeZIndex> = (
  { collections },
  { payload: { id, zIndex } }
) => {
  const collection = query(collections).collection('memoEntities');
  collection.getOrCreate(id, id => createMemo({ id }));

  collection.updateOne(id, memo => {
    memo.ui.zIndex = zIndex;
  });
};

export const memoReducers = {
  [ActionType.addMemo]: addMemo,
  [ActionType.moveMemo]: moveMemo,
  [ActionType.moveToMemo]: moveToMemo,
  [ActionType.removeMemo]: removeMemo,
  [ActionType.changeMemoValue]: changeMemoValue,
  [ActionType.changeMemoColor]: changeMemoColor,
  [ActionType.resizeMemo]: resizeMemo,
  [ActionType.changeZIndex]: changeZIndex,
};

export const actions = {
  addMemoAction,
  moveMemoAction,
  moveToMemoAction,
  removeMemoAction,
  changeMemoValueAction,
  changeMemoColorAction,
  resizeMemoAction,
  changeZIndexAction,
};
