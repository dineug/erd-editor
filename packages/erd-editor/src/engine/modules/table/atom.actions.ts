import { createAction } from '@dineug/r-html';

import {
  ActionMap,
  ActionType,
  ReducerType,
} from '@/engine/modules/table/actions';

export const addTableAction = createAction<
  ActionMap[typeof ActionType.addTable]
>(ActionType.addTable);

const addTable: ReducerType<typeof ActionType.addTable> = (
  state,
  payload,
  ctx
) => {};

export const tableReducers = {
  [ActionType.addTable]: addTable,
};
