import { PanelConfig } from '../../core/panel';
import { ColumnType } from './canvas.state';
import { Table } from './table.state';

export interface EditorState {
  panels: PanelConfig[];
  hasUndo: boolean;
  hasRedo: boolean;
  focusTable: FocusTable | null;
}

export interface FocusTable {
  table: Table;
  columnId: string | null;
  focusType: FocusType;
  selectColumnIds: string[];
  prevSelectColumnId: string | null;
}

export type TableType = 'tableName' | 'tableComment';

export type FocusType = TableType | ColumnType;
