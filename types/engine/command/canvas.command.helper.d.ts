import {
  ShowKey,
  Database,
  CanvasType,
  Language,
  NameCase,
  ColumnType,
} from '../store/canvas.state';
import { Store } from '../store';
import { CommandType } from './index';

export declare function moveCanvas(
  scrollTop: number,
  scrollLeft: number
): CommandType<'canvas.move'>;

export declare function resizeCanvas(
  width: number,
  height: number
): CommandType<'canvas.resize'>;

export declare function changeCanvasShow(
  store: Store,
  showKey: ShowKey
): CommandType<'canvas.changeShow'>;

export declare function changeDatabase(
  database: Database
): CommandType<'canvas.changeDatabase'>;

export declare function changeDatabaseName(
  value: string
): CommandType<'canvas.changeDatabaseName'>;

export declare function changeCanvasType(
  canvasType: CanvasType
): CommandType<'canvas.changeCanvasType'>;

export declare function changeLanguage(
  language: Language
): CommandType<'canvas.changeLanguage'>;

export declare function changeTableCase(
  nameCase: NameCase
): CommandType<'canvas.changeTableCase'>;

export declare function changeColumnCase(
  nameCase: NameCase
): CommandType<'canvas.changeColumnCase'>;

export declare function changeRelationshipDataTypeSync(
  value: boolean
): CommandType<'canvas.changeRelationshipDataTypeSync'>;

export declare function moveColumnOrder(
  columnType: ColumnType,
  targetColumnType: ColumnType
): CommandType<'canvas.moveColumnOrder'>;
