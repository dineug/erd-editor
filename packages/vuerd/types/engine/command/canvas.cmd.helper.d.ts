import { Store } from '../store';
import {
  BracketType,
  ColumnType,
  Database,
  HighlightTheme,
  Language,
  NameCase,
  ShowKey,
} from '../store/canvas.state';
import { CommandType } from './index';

export declare function moveCanvas(
  scrollTop: number,
  scrollLeft: number
): CommandType<'canvas.move'>;

export declare function movementCanvas(
  movementX: number,
  movementY: number
): CommandType<'canvas.movement'>;

export declare function resizeCanvas(
  width: number,
  height: number
): CommandType<'canvas.resize'>;

export declare function zoomCanvas(
  zoomLevel: number
): CommandType<'canvas.zoom'>;

export declare function movementZoomCanvas(
  movementZoomLevel: number
): CommandType<'canvas.movementZoom'>;

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
  canvasType: string
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

export declare function changeRelationshipOptimization(
  value: boolean
): CommandType<'canvas.changeRelationshipOptimization'>;

export declare function moveColumnOrder(
  columnType: ColumnType,
  targetColumnType: ColumnType
): CommandType<'canvas.moveColumnOrder'>;

export declare function changeHighlightTheme(
  highlightTheme: HighlightTheme
): CommandType<'canvas.changeHighlightTheme'>;

export declare function changeBracketType(
  bracketType: BracketType
): CommandType<'canvas.changeBracketType'>;

export declare function changePluginSerialization(
  key: string,
  value: string
): CommandType<'canvas.changePluginSerialization'>;
