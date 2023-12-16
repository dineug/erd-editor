import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addIndexColumn: 'indexColumn.add',
  removeIndexColumn: 'indexColumn.remove',
  moveIndexColumn: 'indexColumn.move',
  changeIndexColumnOrderType: 'indexColumn.changeOrderType',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addIndexColumn]: {
    id: string;
    indexId: string;
    tableId: string;
    columnId: string;
  };
  [ActionType.removeIndexColumn]: {
    id: string;
    indexId: string;
    tableId: string;
  };
  [ActionType.moveIndexColumn]: {
    id: string;
    indexId: string;
    tableId: string;
    targetId: string;
  };
  [ActionType.changeIndexColumnOrderType]: {
    id: string;
    indexId: string;
    columnId: string;
    value: number;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
