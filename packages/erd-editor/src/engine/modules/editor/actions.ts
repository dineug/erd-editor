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
  changeViewport: 'editor.changeViewport',
  clear: 'editor.clear',
  loadJson: 'editor.loadJson',
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
  [ActionType.changeViewport]: {
    width: number;
    height: number;
  };
  [ActionType.clear]: void;
  [ActionType.loadJson]: {
    value: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
