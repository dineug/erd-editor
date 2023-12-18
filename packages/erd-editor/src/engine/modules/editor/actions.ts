import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

import { FocusType, MoveKey, SelectType } from './state';

export const ActionType = {
  changeHasHistory: 'editor.changeHasHistory',
  selectAll: 'editor.selectAll',
  unselectAll: 'editor.unselectAll',
  select: 'editor.select',
  changeViewport: 'editor.changeViewport',
  clear: 'editor.clear',
  loadJson: 'editor.loadJson',
  initialClear: 'editor.initialClear',
  initialLoadJson: 'editor.initialLoadJson',
  focusTable: 'editor.focusTable',
  focusColumn: 'editor.focusColumn',
  focusTableEnd: 'editor.focusTableEnd',
  focusMoveTable: 'editor.focusMoveTable',
  editTable: 'editor.editTable',
  editTableEnd: 'editor.editTableEnd',
  selectAllColumn: 'editor.selectAllColumn',
  drawStartRelationship: 'editor.drawStartRelationship',
  drawStartAddRelationship: 'editor.drawStartAddRelationship',
  drawEndRelationship: 'editor.drawEndRelationship',
  drawRelationship: 'editor.drawRelationship',
  hoverColumnMap: 'editor.hoverColumnMap',
  changeOpenMap: 'editor.changeOpenMap',
  dragstartColumn: 'editor.dragstartColumn',
  dragendColumn: 'editor.dragendColumn',
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
  [ActionType.initialClear]: void;
  [ActionType.initialLoadJson]: {
    value: string;
  };
  [ActionType.focusTable]: {
    tableId: string;
    focusType?: FocusType;
  };
  [ActionType.focusColumn]: {
    tableId: string;
    columnId: string;
    focusType: FocusType;
    $mod: boolean;
    shiftKey: boolean;
  };
  [ActionType.focusTableEnd]: void;
  [ActionType.focusMoveTable]: {
    moveKey: MoveKey;
    shiftKey: boolean;
  };
  [ActionType.editTable]: void;
  [ActionType.editTableEnd]: void;
  [ActionType.selectAllColumn]: void;
  [ActionType.drawStartRelationship]: {
    relationshipType: number;
  };
  [ActionType.drawStartAddRelationship]: {
    tableId: string;
  };
  [ActionType.drawEndRelationship]: void;
  [ActionType.drawRelationship]: {
    x: number;
    y: number;
  };
  [ActionType.hoverColumnMap]: {
    columnIds: string[];
  };
  [ActionType.changeOpenMap]: Record<string, boolean>;
  [ActionType.dragstartColumn]: {
    tableId: string;
    columnIds: string[];
  };
  [ActionType.dragendColumn]: void;
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
