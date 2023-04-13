import { createAction } from '@dineug/r-html';

import {
  ActionMap,
  ActionType,
  ReducerType,
} from '@/engine/modules/tableColumn/actions';

export const addColumnAction = createAction<
  ActionMap[typeof ActionType.addColumn]
>(ActionType.addColumn);

const addColumn: ReducerType<typeof ActionType.addColumn> = (
  state,
  payload,
  ctx
) => {};

export const tableColumnReducers = {
  [ActionType.addColumn]: addColumn,
};
