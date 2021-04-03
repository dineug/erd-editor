import { ColumnType } from '../store/canvas.state';
import {
  TableType,
  MoveKey,
  DraggableColumn,
  Viewport,
} from '../store/editor.state';
import { RelationshipType } from '../store/relationship.state';

export interface HasUndoRedo {
  hasUndo: boolean;
  hasRedo: boolean;
}

export interface FocusTable {
  tableId: string;
  focusType?: TableType;
}

export interface FocusColumn {
  tableId: string;
  columnId: string;
  focusType: ColumnType;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface FocusMoveTable {
  moveKey: MoveKey;
  shiftKey: boolean;
}

export interface DrawStartRelationship {
  relationshipType: RelationshipType;
}

export interface DrawStartAddRelationship {
  tableId: string;
}

export interface DrawRelationship {
  x: number;
  y: number;
}

export interface LoadJson {
  value: string;
}

export interface CopyColumn {
  tableId: string;
  columnIds: string[];
}

export interface ReadonlyEditor {
  readonly: boolean;
}

export interface EditorCommandMap {
  'editor.hasUndoRedo': HasUndoRedo;
  'editor.focusTable': FocusTable;
  'editor.focusColumn': FocusColumn;
  'editor.focusTableEnd': null;
  'editor.focusMoveTable': FocusMoveTable;
  'editor.editTable': null;
  'editor.editTableEnd': null;
  'editor.selectAllColumn': null;
  'editor.drawStartRelationship': DrawStartRelationship;
  'editor.drawStartAddRelationship': DrawStartAddRelationship;
  'editor.drawEndRelationship': null;
  'editor.drawRelationship': DrawRelationship;
  'editor.draggableColumn': DraggableColumn;
  'editor.draggableColumnEnd': null;
  'editor.loadJson': LoadJson;
  'editor.initLoadJson': LoadJson;
  'editor.clear': null;
  'editor.initClear': null;
  'editor.changeViewport': Viewport;
  'editor.copyColumn': CopyColumn;
  'editor.findActive': null;
  'editor.findActiveEnd': null;
  'editor.readonly': ReadonlyEditor;
}
