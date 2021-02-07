import {
  ShowKey,
  Database,
  Language,
  NameCase,
  ColumnType,
} from '../store/canvas.state';

export interface MoveCanvas {
  scrollTop: number;
  scrollLeft: number;
}

export interface MovementCanvas {
  movementX: number;
  movementY: number;
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

export interface CanvasCommandMap {
  'canvas.move': MoveCanvas;
  'canvas.movement': MovementCanvas;
  'canvas.resize': ResizeCanvas;
  'canvas.changeShow': ChangeCanvasShow;
  'canvas.changeDatabase': ChangeDatabase;
  'canvas.changeDatabaseName': ChangeDatabaseName;
  'canvas.changeCanvasType': ChangeCanvasType;
  'canvas.changeLanguage': ChangeLanguage;
  'canvas.changeTableCase': ChangeNameCase;
  'canvas.changeColumnCase': ChangeNameCase;
  'canvas.changeRelationshipDataTypeSync': ChangeRelationshipDataTypeSync;
  'canvas.moveColumnOrder': MoveColumnOrder;
}
