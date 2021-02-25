import { PanelConfig } from '../../core/panel';
import { ColumnType } from './canvas.state';

export interface EditorState {
  panels: PanelConfig[];
  hasUndo: boolean;
  hasRedo: boolean;
  focusTable: FocusTable | null;
}

export interface FocusTable {
  tableId: string;
  columnId: string | null;
  focusType: FocusType;
  selectColumnIds: string[];
}

export type FocusType = 'tableName' | 'tableComment' | ColumnType;
