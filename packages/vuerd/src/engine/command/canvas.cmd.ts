import { CanvasCommandMap } from '@@types/engine/command/canvas.cmd';
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
  ChangeHighlightTheme,
  ChangeBracketType,
} from '@@types/engine/command/canvas.cmd';
import { ExecuteCommand } from '@/internal-types/command';
import round from 'lodash/round';
import { zoomBalanceRange } from '@/engine/store/helper/canvas.helper';
import { createBalanceRange } from '@/core/helper';

export function executeMoveCanvas(
  { canvasState, editorState: { viewport } }: State,
  data: MoveCanvas
) {
  const scrollTopBalanceRange = createBalanceRange(
    viewport.height - canvasState.height,
    0
  );
  const scrollLeftBalanceRange = createBalanceRange(
    viewport.width - canvasState.width,
    0
  );
  canvasState.scrollTop = scrollTopBalanceRange(data.scrollTop);
  canvasState.scrollLeft = scrollLeftBalanceRange(data.scrollLeft);
}

export function executeMovementCanvas(
  { canvasState, editorState: { viewport } }: State,
  data: MovementCanvas
) {
  const scrollTopBalanceRange = createBalanceRange(
    viewport.height - canvasState.height,
    0
  );
  const scrollLeftBalanceRange = createBalanceRange(
    viewport.width - canvasState.width,
    0
  );
  canvasState.scrollTop = scrollTopBalanceRange(
    canvasState.scrollTop + data.movementY
  );
  canvasState.scrollLeft = scrollLeftBalanceRange(
    canvasState.scrollLeft + data.movementX
  );
}

export function executeResizeCanvas(
  { canvasState }: State,
  data: ResizeCanvas
) {
  canvasState.width = data.width;
  canvasState.height = data.height;
}

export function executeZoomCanvas({ canvasState }: State, data: ZoomCanvas) {
  canvasState.zoomLevel = round(zoomBalanceRange(data.zoomLevel), 2);
}

export function executeMovementZoomCanvas(
  { canvasState }: State,
  data: MovementZoomCanvas
) {
  canvasState.zoomLevel = round(
    zoomBalanceRange(canvasState.zoomLevel + data.movementZoomLevel),
    2
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

export function executeChangeHighlightTheme(
  { canvasState }: State,
  data: ChangeHighlightTheme
) {
  canvasState.highlightTheme = data.highlightTheme;
}

export function executeChangeBracketType(
  { canvasState }: State,
  data: ChangeBracketType
) {
  canvasState.bracketType = data.bracketType;
}

export const executeCanvasCommandMap: Record<
  keyof CanvasCommandMap,
  ExecuteCommand
> = {
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
  'canvas.changeRelationshipDataTypeSync':
    executeChangeRelationshipDataTypeSync,
  'canvas.moveColumnOrder': executeMoveColumnOrder,
  'canvas.changeHighlightTheme': executeChangeHighlightTheme,
  'canvas.changeBracketType': executeChangeBracketType,
};
