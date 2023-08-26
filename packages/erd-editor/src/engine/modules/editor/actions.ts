import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

import { SelectType } from './state';

export const ActionType = {
  changeHasHistory: 'editor.changeHasHistory',
  selectAll: 'editor.selectAll',
  unselectAll: 'editor.unselectAll',
  select: 'editor.select',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.changeHasHistory]: {
    hasUndo: boolean;
    hasRedo: boolean;
  };
  [ActionType.selectAll]: void;
  [ActionType.unselectAll]: void;
  [ActionType.select]: Record<string, SelectType>;
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
