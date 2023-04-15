import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addColumn: 'column.add',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addColumn]: {
    id: string;
    tableId: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
