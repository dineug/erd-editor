import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import type { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { RootState } from '@/engine/state';
import { type LWW, Point, ValuesType } from '@/internal-types';
import { Rect } from '@/utils/dragSelect';

import {
  CenterStep,
  FocusType,
  MoveKey,
  ScreenUnit,
  SelectType,
  SharedFocus,
  ShowMode,
  ViewKind,
  VisualizationMode,
} from './state';

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
  editMemo: 'editor.editMemo',
  editMemoEnd: 'editor.editMemoEnd',
  editTableGroup: 'editor.editTableGroup',
  editTableGroupEnd: 'editor.editTableGroupEnd',
  scrollMemo: 'editor.scrollMemo',
  selectAllColumn: 'editor.selectAllColumn',
  drawStartRelationship: 'editor.drawStartRelationship',
  drawStartAddRelationship: 'editor.drawStartAddRelationship',
  drawEndRelationship: 'editor.drawEndRelationship',
  drawRelationship: 'editor.drawRelationship',
  hoverColumnMap: 'editor.hoverColumnMap',
  hoverRelationshipMap: 'editor.hoverRelationshipMap',
  changeOpenMap: 'editor.changeOpenMap',
  changeHandTool: 'editor.changeHandTool',
  changeDrawTableGroup: 'editor.changeDrawTableGroup',
  changeZenMode: 'editor.changeZenMode',
  dragstartColumn: 'editor.dragstartColumn',
  dragendColumn: 'editor.dragendColumn',
  sharedMouseTracker: 'editor.sharedMouseTracker',
  sharedFocusTracker: 'editor.sharedFocusTracker',
  sharedSelectionTracker: 'editor.sharedSelectionTracker',
  sharedDragSelectTracker: 'editor.sharedDragSelectTracker',
  dragSelectRect: 'editor.dragSelectRect',
  getLWW: 'editor.getLWW',
  mergeLWW: 'editor.mergeLWW',
  viewOpen: 'editor.viewOpen',
  viewClose: 'editor.viewClose',
  viewScrollTo: 'editor.viewScrollTo',
  viewStreamScrollTo: 'editor.viewStreamScrollTo',
  viewChangeZoomLevel: 'editor.viewChangeZoomLevel',
  viewStreamZoomLevel: 'editor.viewStreamZoomLevel',
  viewMoveTable: 'editor.viewMoveTable',
  viewSetLayout: 'editor.viewSetLayout',
  viewChangeShowMode: 'editor.viewChangeShowMode',
  viewSetCenters: 'editor.viewSetCenters',
  viewStepCenters: 'editor.viewStepCenters',
  changeVisualizationMode: 'editor.changeVisualizationMode',
  endScreenSettings: 'editor.endScreenSettings',
} as const;
export type ActionType = ValuesType<typeof ActionType>;

/**
 * Set on the clear and the load of a schema import, and of their undo, which
 * leave the store's words, terms and domains and their lists as they are.
 */
export type DictionaryLoadFlag = {
  keepDictionaries?: boolean;
};

export type ActionMap = {
  [ActionType.changeHasHistory]: {
    hasUndo: boolean;
    hasRedo: boolean;
    /** The dictionary sheet whose history this is, none for the document's. */
    sheet?: DictionaryKind;
  };
  [ActionType.selectAll]: void;
  [ActionType.unselectAll]: void;
  [ActionType.select]: Record<string, SelectType>;
  [ActionType.changeViewport]: {
    width: number;
    height: number;
  };
  [ActionType.clear]: DictionaryLoadFlag | void;
  [ActionType.loadJson]: DictionaryLoadFlag & {
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
  [ActionType.editMemo]: {
    id: string;
  };
  [ActionType.editMemoEnd]: void;
  [ActionType.editTableGroup]: {
    id: string;
  };
  [ActionType.editTableGroupEnd]: void;
  [ActionType.scrollMemo]: {
    id: string;
    /** How far down its body the memo is shown from, in body px. */
    scrollTop: number;
  };
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
  [ActionType.hoverRelationshipMap]: {
    relationshipIds: string[];
  };
  [ActionType.changeOpenMap]: Record<string, boolean>;
  [ActionType.changeHandTool]: {
    value: boolean;
  };
  [ActionType.changeDrawTableGroup]: {
    value: boolean;
  };
  [ActionType.changeZenMode]: {
    value: boolean;
  };
  [ActionType.dragstartColumn]: {
    tableId: string;
    columnIds: string[];
  };
  [ActionType.dragendColumn]: void;
  [ActionType.sharedMouseTracker]: {
    x: number;
    y: number;
  };
  [ActionType.sharedFocusTracker]: {
    focus: SharedFocus | null;
  };
  [ActionType.sharedSelectionTracker]: {
    selectedIds: string[];
  };
  [ActionType.sharedDragSelectTracker]: {
    rect: Rect | null;
  };
  [ActionType.dragSelectRect]: {
    rect: Rect | null;
  };
  [ActionType.getLWW]: void;
  [ActionType.mergeLWW]: {
    lww: LWW;
  };
  [ActionType.viewOpen]: {
    kind: ViewKind;
    /** The tables the view opens narrowed to; none and it opens on the whole document. */
    centerIds?: string[];
  };
  [ActionType.viewClose]: {
    kind: ViewKind;
  };
  [ActionType.viewScrollTo]: {
    originX: number;
    originY: number;
    kind?: ViewKind;
  };
  [ActionType.viewStreamScrollTo]: {
    movementX: number;
    movementY: number;
    kind?: ViewKind;
  };
  [ActionType.viewChangeZoomLevel]: {
    value: number;
    kind?: ViewKind;
  };
  [ActionType.viewStreamZoomLevel]: {
    value: number;
    kind?: ViewKind;
  };
  [ActionType.viewMoveTable]: {
    ids: string[];
    movementX: number;
    movementY: number;
    kind?: ViewKind;
  };
  [ActionType.viewSetLayout]: {
    kind: ViewKind;
    positions: Record<string, Point>;
  };
  [ActionType.viewChangeShowMode]: {
    value: ShowMode;
    kind?: ViewKind;
  };
  [ActionType.viewSetCenters]: {
    tableIds: string[];
    kind?: ViewKind;
  };
  [ActionType.viewStepCenters]: {
    step: CenterStep;
    kind?: ViewKind;
  };
  [ActionType.changeVisualizationMode]: {
    value: VisualizationMode;
  };
  [ActionType.endScreenSettings]: {
    units: ScreenUnit[];
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
