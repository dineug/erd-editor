import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addColumn: 'column.add',
  removeColumn: 'column.remove',
  changeColumnName: 'column.changeName',
  changeColumnComment: 'column.changeComment',
  changeColumnDataType: 'column.changeDataType',
  changeColumnDefault: 'column.changeDefault',
  changeColumnAutoIncrement: 'column.changeAutoIncrement',
  changeColumnPrimaryKey: 'column.changePrimaryKey',
  changeColumnUnique: 'column.changeUnique',
  changeColumnNotNull: 'column.changeNotNull',
  moveColumn: 'column.move',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addColumn]: {
    id: string;
    tableId: string;
  };
  [ActionType.removeColumn]: {
    id: string;
    tableId: string;
  };
  [ActionType.changeColumnName]: ChangeColumnValuePayload;
  [ActionType.changeColumnComment]: ChangeColumnValuePayload;
  [ActionType.changeColumnDataType]: ChangeColumnValuePayload;
  [ActionType.changeColumnDefault]: ChangeColumnValuePayload;
  [ActionType.changeColumnAutoIncrement]: ChangeColumnOptionPayload;
  [ActionType.changeColumnPrimaryKey]: ChangeColumnOptionPayload;
  [ActionType.changeColumnUnique]: ChangeColumnOptionPayload;
  [ActionType.changeColumnNotNull]: ChangeColumnOptionPayload;
  [ActionType.moveColumn]: {
    id: string;
    tableId: string;
    targetId: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;

export type ChangeColumnValuePayload = {
  tableId: string;
  id: string;
  value: string;
};

type ChangeColumnOptionPayload = {
  tableId: string;
  id: string;
  value: boolean;
};
