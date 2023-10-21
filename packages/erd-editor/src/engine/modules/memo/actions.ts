import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addMemo: 'memo.add',
  moveMemo: 'memo.move',
  removeMemo: 'memo.remove',
  changeMemoValue: 'memo.changeValue',
  changeMemoColor: 'memo.changeColor',
  resizeMemo: 'memo.resize',
  changeZIndex: 'memo.changeZIndex',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addMemo]: {
    id: string;
    ui: {
      x: number;
      y: number;
      zIndex: number;
    };
  };
  [ActionType.moveMemo]: {
    movementX: number;
    movementY: number;
    ids: string[];
  };
  [ActionType.removeMemo]: {
    id: string;
  };
  [ActionType.changeMemoValue]: {
    id: string;
    value: string;
  };
  [ActionType.changeMemoColor]: {
    ids: string[];
    color: string;
  };
  [ActionType.resizeMemo]: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [ActionType.changeZIndex]: {
    id: string;
    zIndex: number;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
