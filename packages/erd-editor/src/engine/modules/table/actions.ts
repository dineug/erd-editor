import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addTable: 'table.add',
  moveTable: 'table.move',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addTable]: {
    id: string;
    ui: {
      x: number;
      y: number;
      zIndex: number;
    };
  };
  [ActionType.moveTable]: {
    movementX: number;
    movementY: number;
    tableIds: string[];
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
