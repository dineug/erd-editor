import {
  changeDatabase,
  changeDatabaseName,
  moveCanvas,
  resizeCanvas,
  zoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { createCommand } from '@/engine/command/helper';
import { IStore } from '@/internal-types/store';
import { BatchCommand } from '@@types/engine/command';
import { ChangeCanvasShow } from '@@types/engine/command/canvas.cmd';

export function executeMoveCanvas(
  { canvasState: { scrollTop, scrollLeft } }: IStore,
  batchUndoCommand: BatchCommand
) {
  batchUndoCommand.push(moveCanvas(scrollTop, scrollLeft));
}

export function executeResizeCanvas(
  { canvasState: { width, height } }: IStore,
  batchUndoCommand: BatchCommand
) {
  batchUndoCommand.push(resizeCanvas(width, height));
}

export function executeZoomCanvas(
  { canvasState: { zoomLevel } }: IStore,
  batchUndoCommand: BatchCommand
) {
  batchUndoCommand.push(zoomCanvas(zoomLevel));
}

export function executeChangeCanvasShow(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeCanvasShow
) {
  batchUndoCommand.push(
    createCommand('canvas.changeShow', {
      showKey: data.showKey,
      value: !data.value,
    })
  );
}

export function executeChangeDatabase(
  { canvasState: { database } }: IStore,
  batchUndoCommand: BatchCommand
) {
  batchUndoCommand.push(changeDatabase(database));
}

export function executeChangeDatabaseName(
  { canvasState: { databaseName } }: IStore,
  batchUndoCommand: BatchCommand
) {
  batchUndoCommand.push(changeDatabaseName(databaseName));
}

export const executeCanvasCommandMap = {
  'canvas.move': executeMoveCanvas,
  'canvas.resize': executeResizeCanvas,
  'canvas.zoom': executeZoomCanvas,
  'canvas.changeShow': executeChangeCanvasShow,
  'canvas.changeDatabase': executeChangeDatabase,
  'canvas.changeDatabaseName': executeChangeDatabaseName,
};
