import {
  MoveCanvas,
  ResizeCanvas,
  ChangeCanvasShow,
  ChangeDatabase,
  ChangeDatabaseName,
  ChangeCanvasType,
  ChangeLanguage,
  ChangeNameCase,
  ChangeRelationshipDataTypeSync,
  MoveColumnOrder,
} from './canvas.command';

export interface CommandMap {
  'canvas.move': MoveCanvas;
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

export type CommandKey = keyof CommandMap;

export interface CommandType<K extends CommandKey> {
  name: K;
  data: CommandMap[K];
}

export interface CommandTypeAny {
  name: string;
  data: any;
}
