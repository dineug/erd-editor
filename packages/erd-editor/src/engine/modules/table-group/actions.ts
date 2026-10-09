import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addTableGroup: 'tableGroup.add',
  moveTableGroup: 'tableGroup.move',
  moveToTableGroup: 'tableGroup.moveTo',
  removeTableGroup: 'tableGroup.remove',
  resizeTableGroup: 'tableGroup.resize',
  changeTableGroupName: 'tableGroup.changeName',
  changeTableGroupColor: 'tableGroup.changeColor',
  changeTableGroupZIndex: 'tableGroup.changeZIndex',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.addTableGroup]: {
    id: string;
    color?: string;
    ui: {
      x: number;
      y: number;
      width: number;
      height: number;
      zIndex: number;
    };
  };
  [ActionType.moveTableGroup]: {
    movementX: number;
    movementY: number;
    ids: string[];
  };
  [ActionType.moveToTableGroup]: {
    id: string;
    x: number;
    y: number;
  };
  [ActionType.removeTableGroup]: {
    id: string;
  };
  [ActionType.resizeTableGroup]: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [ActionType.changeTableGroupName]: {
    id: string;
    value: string;
  };
  [ActionType.changeTableGroupColor]: {
    id: string;
    color: string;
    prevColor: string;
  };
  [ActionType.changeTableGroupZIndex]: {
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
