import {
  ShowKey,
  Database,
  CanvasType,
  Language,
  NameCase,
  ColumnType,
} from '../store/canvas.state';

export interface MoveCanvas {
  scrollTop: number;
  scrollLeft: number;
}

export interface ResizeCanvas {
  width: number;
  height: number;
}

export interface ChangeCanvasShow {
  showKey: ShowKey;
  value: boolean;
}

export interface ChangeDatabase {
  database: Database;
}

export interface ChangeDatabaseName {
  value: string;
}

export interface ChangeCanvasType {
  canvasType: string;
}

export interface ChangeLanguage {
  language: Language;
}

export interface ChangeNameCase {
  nameCase: NameCase;
}

export interface ChangeRelationshipDataTypeSync {
  value: boolean;
}

export interface MoveColumnOrder {
  columnType: ColumnType;
  targetColumnType: ColumnType;
}
