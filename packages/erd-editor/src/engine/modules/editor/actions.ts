import { Reducer } from '@dineug/r-html';

import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { type LWW, Point, ValuesType } from '@/internal-types';
import { Rect } from '@/utils/dragSelect';

import {
  FocusType,
  MoveKey,
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
  changeZenMode: 'editor.changeZenMode',
  dragstartColumn: 'editor.dragstartColumn',
  dragendColumn: 'editor.dragendColumn',
  sharedMouseTracker: 'editor.sharedMouseTracker',
  sharedFocusTracker: 'editor.sharedFocusTracker',
  sharedSelectionTracker: 'editor.sharedSelectionTracker',
  sharedDragSelectTracker: 'editor.sharedDragSelectTracker',
  dragSelectRect: 'editor.dragSelectRect',
  validationIds: 'editor.validationIds',
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
  viewChangeHop: 'editor.viewChangeHop',
  viewSetCenters: 'editor.viewSetCenters',
  viewHistoryMove: 'editor.viewHistoryMove',
  changeVisualizationMode: 'editor.changeVisualizationMode',
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
  [ActionType.editMemo]: {
    id: string;
  };
  [ActionType.editMemoEnd]: void;
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
  [ActionType.validationIds]: void;
  [ActionType.getLWW]: void;
  [ActionType.mergeLWW]: {
    lww: LWW;
  };
  [ActionType.viewOpen]: {
    kind: ViewKind;
    /** The tables a Focus view opens on. A Flow view takes none. */
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
  [ActionType.viewChangeHop]: {
    value: number;
  };
  [ActionType.viewSetCenters]: {
    tableIds: string[];
    /** Whether the centers open a new history entry rather than rewriting the current one. */
    push?: boolean;
  };
  [ActionType.viewHistoryMove]: {
    /** How many entries to walk, negative for back. */
    delta: number;
  };
  [ActionType.changeVisualizationMode]: {
    value: VisualizationMode;
  };
};

export type ReducerType<T extends keyof ActionMap> = Reducer<
  RootState,
  T,
  ActionMap,
  EngineContext
>;
