import { createAction } from '@dineug/r-html';

import { ActionMap, ActionType, ReducerType } from './actions';

export const changeDatabaseNameAction = createAction<
  ActionMap[typeof ActionType.changeDatabaseName]
>(ActionType.changeDatabaseName);

const changeDatabaseName: ReducerType<typeof ActionType.changeDatabaseName> = (
  { settings },
  { value }
) => {
  settings.databaseName = value;
};

export const resizeAction = createAction<ActionMap[typeof ActionType.resize]>(
  ActionType.resize
);

const resize: ReducerType<typeof ActionType.resize> = (
  { settings },
  { width, height }
) => {
  settings.width = width;
  settings.height = height;
};

export const settingsReducers = {
  [ActionType.changeDatabaseName]: changeDatabaseName,
  [ActionType.resize]: resize,
};

export const actions = {
  changeDatabaseNameAction,
  resizeAction,
};
