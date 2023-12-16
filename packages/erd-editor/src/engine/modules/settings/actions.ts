import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

export const ActionType = {
  changeDatabaseName: 'settings.changeDatabaseName',
  resize: 'settings.resize',
  changeZoomLevel: 'settings.changeZoomLevel',
  streamZoomLevel: 'settings.streamZoomLevel',
  scrollTo: 'settings.scrollTo',
  streamScrollTo: 'settings.streamScrollTo',
  changeShow: 'settings.changeShow',
  changeDatabase: 'settings.changeDatabase',
  changeCanvasType: 'settings.changeCanvasType',
  changeLanguage: 'settings.changeLanguage',
  changeTableNameCase: 'settings.changeTableNameCase',
  changeColumnNameCase: 'settings.changeColumnNameCase',
  changeBracketType: 'settings.changeBracketType',
  changeRelationshipDataTypeSync: 'settings.changeRelationshipDataTypeSync',
  changeRelationshipOptimization: 'settings.changeRelationshipOptimization',
  changeColumnOrder: 'settings.changeColumnOrder',
  changeMaxWidthComment: 'settings.changeMaxWidthComment',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

export type ActionMap = {
  [ActionType.changeDatabaseName]: {
    value: string;
  };
  [ActionType.resize]: {
    width: number;
    height: number;
  };
  [ActionType.changeZoomLevel]: {
    value: number;
  };
  [ActionType.streamZoomLevel]: {
    value: number;
  };
  [ActionType.scrollTo]: {
    scrollTop: number;
    scrollLeft: number;
  };
  [ActionType.streamScrollTo]: {
    movementX: number;
    movementY: number;
  };
  [ActionType.changeShow]: {
    show: number;
    value: boolean;
  };
  [ActionType.changeDatabase]: {
    value: number;
  };
  [ActionType.changeCanvasType]: {
    value: string;
  };
  [ActionType.changeLanguage]: {
    value: number;
  };
  [ActionType.changeTableNameCase]: {
    value: number;
  };
  [ActionType.changeColumnNameCase]: {
    value: number;
  };
  [ActionType.changeBracketType]: {
    value: number;
  };
  [ActionType.changeRelationshipDataTypeSync]: {
    value: boolean;
  };
  [ActionType.changeRelationshipOptimization]: {
    value: boolean;
  };
  [ActionType.changeColumnOrder]: {
    value: number;
    target: number;
  };
  [ActionType.changeMaxWidthComment]: {
    value: number;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
