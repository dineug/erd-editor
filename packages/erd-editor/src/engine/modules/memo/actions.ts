import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addMemo: 'memo.add',
  moveMemo: 'memo.move',
  moveToMemo: 'memo.moveTo',
  removeMemo: 'memo.remove',
  changeMemoValue: 'memo.changeValue',
  changeMemoColor: 'memo.changeColor',
  resizeMemo: 'memo.resize',
  changeZIndex: 'memo.changeZIndex',
  changeMemoGroup: 'memo.changeGroup',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addMemo]: {
    id: string;
    ui: {
      x: number;
      y: number;
      zIndex: number;
      color?: string;
      width?: number;
      height?: number;
    };
  };
  [ActionType.moveMemo]: {
    movementX: number;
    movementY: number;
    ids: string[];
  };
  [ActionType.moveToMemo]: {
    id: string;
    x: number;
    y: number;
  };
  [ActionType.removeMemo]: {
    id: string;
  };
  [ActionType.changeMemoValue]: {
    id: string;
    value: string;
  };
  [ActionType.changeMemoColor]: {
    id: string;
    color: string;
    prevColor: string;
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
  [ActionType.changeMemoGroup]: {
    id: string;
    value: string;
    /**
     * The groupId the memo held, sent by a drop alone: its undo is written as
     * the drag it ends closes, after the reducer has run, so it cannot read it.
     */
    prevValue?: string;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
