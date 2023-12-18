import { arrayHas } from '@dineug/shared';

import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { Point, ValuesType } from '@/internal-types';

export type Editor = {
  selectedMap: Record<string, SelectType>;
  hasUndo: boolean;
  hasRedo: boolean;
  viewport: Viewport;
  focusTable: FocusTable | null;
  drawRelationship: DrawRelationship | null;
  hoverColumnMap: Record<string, boolean>;
  openMap: Record<string, boolean>;
  draggableColumn: DraggableColumn | null;
  draggingColumnMap: Record<string, boolean>;
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

export const createEditor = (): Editor => ({
  selectedMap: {},
  hasUndo: false,
  hasRedo: false,
  viewport: {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  },
  focusTable: null,
  drawRelationship: null,
  hoverColumnMap: {},
  openMap: {},
  draggableColumn: null,
  draggingColumnMap: {},
});
