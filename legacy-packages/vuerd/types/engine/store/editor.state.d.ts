import { PanelConfig } from '../../core/panel';
import { ColumnType } from './canvas.state';
import { FilterState } from './editor/filter.state';
import { Point, RelationshipType } from './relationship.state';
import { Column, Table } from './table.state';

export interface EditorState {
  panels: PanelConfig[];
  excludePanel: RegExp[];
  hasUndo: boolean;
  hasRedo: boolean;
  focusTable: FocusTable | null;
  drawRelationship: DrawRelationship | null;
  draggableColumn: DraggableColumn | null;
  viewport: Viewport;
  copyColumns: Column[];
  findActive: boolean;
  readonly: boolean;
  filterState: FilterState;
  erdUiEventNone: boolean;
}

export interface FocusTable {
  table: Table;
  columnId: string | null;
  focusType: FocusType;
  selectColumnIds: string[];
  prevSelectColumnId: string | null;
  edit: boolean;
}

export interface DrawRelationship {
  relationshipType: RelationshipType;
  start: DrawStartPoint | null;
  end: Point;
}

export interface DrawStartPoint extends Point {
  table: Table;
}

export interface DraggableColumn {
  tableId: string;
  columnIds: string[];
}

export interface Viewport {
  width: number;
  height: number;
}

export type TableType = 'tableName' | 'tableComment';

export type FocusType = TableType | ColumnType;

export type MoveKey =
  | 'ArrowUp'
  | 'ArrowRight'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'Tab';
