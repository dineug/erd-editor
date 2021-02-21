import {
  ShowKey,
  Database,
  Language,
  NameCase,
  ColumnType,
} from '@@types/engine/store/canvas.state';
import { Store } from '@@types/engine/store';
import { createCommand } from './command.helper';
import { zoomBalanceRange } from '@/engine/store/canvas.helper';

export const moveCanvas = (scrollTop: number, scrollLeft: number) =>
  createCommand('canvas.move', { scrollTop, scrollLeft });

export const movementCanvas = (movementX: number, movementY: number) =>
  createCommand('canvas.movement', { movementX, movementY });

export const resizeCanvas = (width: number, height: number) =>
  createCommand('canvas.resize', { width, height });

export const zoomCanvas = (zoomLevel: number) =>
  createCommand('canvas.zoom', {
    zoomLevel: zoomBalanceRange(zoomLevel),
  });

export const movementZoomCanvas = (movementZoomLevel: number) =>
  createCommand('canvas.movementZoom', {
    movementZoomLevel,
  });

export const changeCanvasShow = (
  { canvasState: { show } }: Store,
  showKey: ShowKey
) => createCommand('canvas.changeShow', { showKey, value: !show[showKey] });

export const changeDatabase = (database: Database) =>
  createCommand('canvas.changeDatabase', { database });

export const changeDatabaseName = (value: string) =>
  createCommand('canvas.changeDatabaseName', { value });

export const changeCanvasType = (canvasType: string) =>
  createCommand('canvas.changeCanvasType', { canvasType });

export const changeLanguage = (language: Language) =>
  createCommand('canvas.changeLanguage', { language });

export const changeTableCase = (nameCase: NameCase) =>
  createCommand('canvas.changeTableCase', { nameCase });

export const changeColumnCase = (nameCase: NameCase) =>
  createCommand('canvas.changeColumnCase', { nameCase });

export const changeRelationshipDataTypeSync = (value: boolean) =>
  createCommand('canvas.changeRelationshipDataTypeSync', { value });

export const moveColumnOrder = (
  columnType: ColumnType,
  targetColumnType: ColumnType
) => createCommand('canvas.moveColumnOrder', { columnType, targetColumnType });
