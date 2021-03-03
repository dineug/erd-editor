import { State } from '@@types/engine/store';
import {
  MoveCanvas,
  MovementCanvas,
  ResizeCanvas,
  ZoomCanvas,
  MovementZoomCanvas,
  ChangeCanvasShow,
  ChangeDatabase,
  ChangeDatabaseName,
  ChangeCanvasType,
  ChangeLanguage,
  ChangeNameCase,
  ChangeRelationshipDataTypeSync,
  MoveColumnOrder,
} from '@@types/engine/command/canvas.cmd';
import { zoomBalanceRange } from '@/engine/store/helper/canvas.helper';

export function executeMoveCanvas({ canvasState }: State, data: MoveCanvas) {
  canvasState.scrollTop = data.scrollTop;
  canvasState.scrollLeft = data.scrollLeft;
}

export function executeMovementCanvas(
  { canvasState }: State,
  data: MovementCanvas
) {
  canvasState.scrollTop += data.movementY;
  canvasState.scrollLeft += data.movementX;
}

export function executeResizeCanvas(
  { canvasState }: State,
  data: ResizeCanvas
) {
  canvasState.width = data.width;
  canvasState.height = data.height;
}

export function executeZoomCanvas({ canvasState }: State, data: ZoomCanvas) {
  canvasState.zoomLevel = zoomBalanceRange(data.zoomLevel);
}

export function executeMovementZoomCanvas(
  { canvasState }: State,
  data: MovementZoomCanvas
) {
  canvasState.zoomLevel = zoomBalanceRange(
    canvasState.zoomLevel + data.movementZoomLevel
  );
}

export function executeChangeCanvasShow(
  { canvasState: { show } }: State,
  data: ChangeCanvasShow
) {
  show[data.showKey] = data.value;
}

export function executeChangeDatabase(
  { canvasState }: State,
  data: ChangeDatabase
) {
  canvasState.database = data.database;
}

export function executeChangeDatabaseName(
  { canvasState }: State,
  data: ChangeDatabaseName
) {
  canvasState.databaseName = data.value;
}

export function executeChangeCanvasType(
  { canvasState }: State,
  data: ChangeCanvasType
) {
  canvasState.canvasType = data.canvasType;
}

export function executeChangeLanguage(
  { canvasState }: State,
  data: ChangeLanguage
) {
  canvasState.language = data.language;
}

export function executeChangeTableCase(
  { canvasState }: State,
  data: ChangeNameCase
) {
  canvasState.tableCase = data.nameCase;
}

export function executeChangeColumnCase(
  { canvasState }: State,
  data: ChangeNameCase
) {
  canvasState.columnCase = data.nameCase;
}

export function executeChangeRelationshipDataTypeSync(
  { canvasState: { setting } }: State,
  data: ChangeRelationshipDataTypeSync
) {
  setting.relationshipDataTypeSync = data.value;
}

export function executeMoveColumnOrder(
  {
    canvasState: {
      setting: { columnOrder },
    },
  }: State,
  data: MoveColumnOrder
) {
  if (data.columnType === data.targetColumnType) return;

  const targetIndex = columnOrder.indexOf(data.targetColumnType);
  const currentIndex = columnOrder.indexOf(data.columnType);
  if (targetIndex === -1 || currentIndex === -1) return;

  columnOrder.splice(currentIndex, 1);
  columnOrder.splice(targetIndex, 0, data.columnType);
}

export const executeCanvasCommandMap = {
  'canvas.move': executeMoveCanvas,
  'canvas.movement': executeMovementCanvas,
  'canvas.resize': executeResizeCanvas,
  'canvas.zoom': executeZoomCanvas,
  'canvas.movementZoom': executeMovementZoomCanvas,
  'canvas.changeShow': executeChangeCanvasShow,
  'canvas.changeDatabase': executeChangeDatabase,
  'canvas.changeDatabaseName': executeChangeDatabaseName,
  'canvas.changeCanvasType': executeChangeCanvasType,
  'canvas.changeLanguage': executeChangeLanguage,
  'canvas.changeTableCase': executeChangeTableCase,
  'canvas.changeColumnCase': executeChangeColumnCase,
  'canvas.changeRelationshipDataTypeSync': executeChangeRelationshipDataTypeSync,
  'canvas.moveColumnOrder': executeMoveColumnOrder,
};
