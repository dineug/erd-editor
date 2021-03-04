import { PanelConfig } from '../../core/panel';
import { ColumnType } from './canvas.state';
import { Table } from './table.state';
import { RelationshipType, Point } from './relationship.state';

export interface EditorState {
  panels: PanelConfig[];
  hasUndo: boolean;
  hasRedo: boolean;
  focusTable: FocusTable | null;
  drawRelationship: DrawRelationship | null;
  draggableColumn: DraggableColumn | null;
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

export type TableType = 'tableName' | 'tableComment';

export type FocusType = TableType | ColumnType;

export type MoveKey =
  | 'ArrowUp'
  | 'ArrowRight'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'Tab';
