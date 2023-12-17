import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  addTable: 'table.add',
  moveTable: 'table.move',
  moveToTable: 'table.moveTo',
  removeTable: 'table.remove',
  changeTableName: 'table.changeName',
  changeTableComment: 'table.changeComment',
  changeTableColor: 'table.changeColor',
  changeZIndex: 'table.changeZIndex',
  sortTable: 'table.sort',
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
    ids: string[];
  };
  [ActionType.moveToTable]: {
    id: string;
    x: number;
    y: number;
  };
  [ActionType.removeTable]: {
    id: string;
  };
  [ActionType.changeTableName]: ChangeTableValuePayload;
  [ActionType.changeTableComment]: ChangeTableValuePayload;
  [ActionType.changeTableColor]: {
    id: string;
    color: string;
    prevColor: string;
  };
  [ActionType.changeZIndex]: {
    id: string;
    zIndex: number;
  };
  [ActionType.sortTable]: void;
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;

type ChangeTableValuePayload = {
  id: string;
  value: string;
};
