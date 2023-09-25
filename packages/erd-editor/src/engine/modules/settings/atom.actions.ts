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

export const settingsReducers = {
  [ActionType.changeDatabaseName]: changeDatabaseName,
};

export const actions = {
  changeDatabaseNameAction,
};
