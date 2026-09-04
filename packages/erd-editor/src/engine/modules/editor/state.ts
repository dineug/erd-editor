import { arrayHas, nanoid } from '@dineug/shared';

import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { Point, ValuesType } from '@/internal-types';
import { Rect } from '@/utils/dragSelect';

export type Editor = {
  id: string;
  selectedMap: Record<string, SelectType>;
  hasUndo: boolean;
  hasRedo: boolean;
  viewport: Viewport;
  focusTable: FocusTable | null;
  /** The memo whose body an overlay editor is open on, and null while none is. */
  editMemoId: string | null;
  /**
   * How far down its body each memo is shown from, by memo id. The scene and
   * the overlay editor both read it, so the lines a body shows survive the
   * editor opening and closing over it. Local to this client, never the file.
   */
  memoScrollTopMap: Record<string, number>;
  drawRelationship: DrawRelationship | null;
  hoverColumnMap: Record<string, boolean>;
  hoverRelationshipMap: Record<string, boolean>;
  openMap: Record<string, boolean>;
  draggableColumn: DraggableColumn | null;
  draggingColumnMap: Record<string, boolean>;
  sharedMouseTrackerMap: Record<string, SharedMouseTracker>;
  sharedFocusTrackerMap: Record<string, SharedFocusTracker>;
  sharedSelectionTrackerMap: Record<string, SharedSelectionTracker>;
  sharedDragSelectTrackerMap: Record<string, SharedDragSelectTracker>;
  dragSelect: Rect | null;
};

export type Viewport = {
  width: number;
  height: number;
};

export type FocusTable = {
  tableId: string;
  columnId: string | null;
  focusType: FocusType;
  selectColumnIds: string[];
  prevSelectColumnId: string | null;
  edit: boolean;
};

export type DrawRelationship = {
  relationshipType: number;
  start:
    | (Point & {
        tableId: string;
      })
    | null;
  end: Point;
};

export type DraggableColumn = {
  tableId: string;
  columnIds: string[];
};

export type SharedMouseTracker = {
  id: string;
  x: number;
  y: number;
  nickname: string;
  timeoutId: any;
};

export type SharedFocus = {
  tableId: string;
  columnId: string | null;
  focusType: FocusType;
};

export type SharedFocusTracker = SharedFocus & {
  id: string;
  timeoutId: any;
};

export type SharedSelectionTracker = {
  id: string;
  selectedIds: string[];
  timeoutId: any;
};

export type SharedDragSelectTracker = Rect & {
  id: string;
  timeoutId: any;
};

export const SelectType = {
  table: 'table',
  memo: 'memo',
} as const;
export type SelectType = ValuesType<typeof SelectType>;

export const FocusType = {
  tableName: 'tableName',
  tableComment: 'tableComment',
  columnName: 'columnName',
  columnDataType: 'columnDataType',
  columnNotNull: 'columnNotNull',
  columnUnique: 'columnUnique',
  columnAutoIncrement: 'columnAutoIncrement',
  columnDefault: 'columnDefault',
  columnComment: 'columnComment',
} as const;
export type FocusType = ValuesType<typeof FocusType>;

export const MoveKey = {
  ArrowUp: 'ArrowUp',
  ArrowRight: 'ArrowRight',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  Tab: 'Tab',
};
export type MoveKey = ValuesType<typeof MoveKey>;
export const hasMoveKeys = arrayHas(Object.values(MoveKey));

/**
 * Whether the memo body editor owns the keyboard. Its textarea covers no grid,
 * so the traversal and edit keys a focused table would otherwise answer belong
 * to the caret for as long as it is open.
 */
export const isEditingMemo = ({ editMemoId }: Editor): boolean =>
  Boolean(editMemoId);

/**
 * Whether a live text editor owns the keyboard. A memo body and a table cell
 * both open a real input over the scene, so a canvas shortcut stands down for
 * either of them rather than for the cell alone.
 */
export const isEditingText = (editor: Editor): boolean =>
  isEditingMemo(editor) || Boolean(editor.focusTable?.edit);

export const createEditor = (): Editor => ({
  id: nanoid(),
  selectedMap: {},
  hasUndo: false,
  hasRedo: false,
  viewport: {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  },
  focusTable: null,
  editMemoId: null,
  memoScrollTopMap: {},
  drawRelationship: null,
  hoverColumnMap: {},
  hoverRelationshipMap: {},
  openMap: {},
  draggableColumn: null,
  draggingColumnMap: {},
  sharedMouseTrackerMap: {},
  sharedFocusTrackerMap: {},
  sharedSelectionTrackerMap: {},
  sharedDragSelectTrackerMap: {},
  dragSelect: null,
});
