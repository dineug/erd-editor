import {
  movementCanvas,
  movementZoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { createCommand } from '@/engine/command/helper';
import { BatchCommand, CommandTypeAll } from '@@types/engine/command';
import {
  MovementCanvas,
  MovementZoomCanvas,
} from '@@types/engine/command/canvas.cmd';
import { MoveMemo } from '@@types/engine/command/memo.cmd';
import { MoveTable } from '@@types/engine/command/table.cmd';

const MOVE_MIN = 20;

export function executeMoveTable(
  commands: CommandTypeAll[],
  batchUndoCommand: BatchCommand,
  batchRedoCommand: BatchCommand
) {
  const moveTableCommands = commands.filter(
    command => command.name === 'table.move'
  );
  if (!moveTableCommands.length) return;

  const data = moveTableCommands[0].data as MoveTable;
  const tableIds = data.tableIds;
  const memoIds = data.memoIds;
  let movementX = 0;
  let movementY = 0;

  moveTableCommands.forEach(moveTableCommand => {
    const data = moveTableCommand.data as MoveTable;
    movementX += data.movementX;
    movementY += data.movementY;
  });

  if (Math.abs(movementX) + Math.abs(movementY) < MOVE_MIN) return;

  batchUndoCommand.push(
    createCommand('table.move', {
      movementX: -1 * movementX,
      movementY: -1 * movementY,
      tableIds,
      memoIds,
    })
  );
  batchRedoCommand.push(
    createCommand('table.move', {
      movementX,
      movementY,
      tableIds,
      memoIds,
    })
  );
}

export function executeMoveMemo(
  commands: CommandTypeAll[],
  batchUndoCommand: BatchCommand,
  batchRedoCommand: BatchCommand
) {
  const moveMemoCommands = commands.filter(
    command => command.name === 'memo.move'
  );
  if (!moveMemoCommands.length) return;

  const data = moveMemoCommands[0].data as MoveMemo;
  const tableIds = data.tableIds;
  const memoIds = data.memoIds;
  let movementX = 0;
  let movementY = 0;

  moveMemoCommands.forEach(moveTableCommand => {
    const data = moveTableCommand.data as MoveMemo;
    movementX += data.movementX;
    movementY += data.movementY;
  });

  if (Math.abs(movementX) + Math.abs(movementY) < MOVE_MIN) return;

  batchUndoCommand.push(
    createCommand('memo.move', {
      movementX: -1 * movementX,
      movementY: -1 * movementY,
      tableIds,
      memoIds,
    })
  );
  batchRedoCommand.push(
    createCommand('memo.move', {
      movementX,
      movementY,
      tableIds,
      memoIds,
    })
  );
}

export function executeResizeMemo(
  commands: CommandTypeAll[],
  batchUndoCommand: BatchCommand,
  batchRedoCommand: BatchCommand
) {
  const resizeMemoCommands = commands.filter(
    command => command.name === 'memo.resize'
  );
  if (resizeMemoCommands.length < 2) return;

  batchUndoCommand.push(resizeMemoCommands[0]);
  batchRedoCommand.push(resizeMemoCommands[resizeMemoCommands.length - 1]);
}

export function executeMovementCanvas(
  commands: CommandTypeAll[],
  batchUndoCommand: BatchCommand,
  batchRedoCommand: BatchCommand
) {
  const moveCanvasCommands = commands.filter(
    command => command.name === 'canvas.movement'
  );
  if (!moveCanvasCommands.length) return;

  let movementX = 0;
  let movementY = 0;

  moveCanvasCommands.forEach(moveCanvasCommand => {
    const data = moveCanvasCommand.data as MovementCanvas;
    movementX += data.movementX;
    movementY += data.movementY;
  });

  if (Math.abs(movementX) + Math.abs(movementY) < MOVE_MIN) return;

  batchUndoCommand.push(movementCanvas(-1 * movementX, -1 * movementY));
  batchRedoCommand.push(movementCanvas(movementX, movementY));
}

export function executeMovementZoomCanvas(
  commands: CommandTypeAll[],
  batchUndoCommand: BatchCommand,
  batchRedoCommand: BatchCommand
) {
  const zoomCanvasCommands = commands.filter(
    command => command.name === 'canvas.movementZoom'
  );
  if (!zoomCanvasCommands.length) return;

  const movementZoomLevel = zoomCanvasCommands
    .map(
      zoomCanvasCommand =>
        (zoomCanvasCommand.data as MovementZoomCanvas).movementZoomLevel
    )
    .reduce((acc, cur) => acc + cur, 0);

  batchUndoCommand.push(movementZoomCanvas(-1 * movementZoomLevel));
  batchRedoCommand.push(movementZoomCanvas(movementZoomLevel));
}

export const executeStreamCommandMap = {
  'table.move': executeMoveTable,
  'memo.move': executeMoveMemo,
  'memo.resize': executeResizeMemo,
  'canvas.movement': executeMovementCanvas,
  'canvas.movementZoom': executeMovementZoomCanvas,
};
