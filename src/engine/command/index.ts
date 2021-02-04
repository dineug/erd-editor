import { Command } from '@@types/engine/command';
import * as CanvasCommand from './canvas.command.helper';

export const createCommand = (): Command => ({
  canvas: CanvasCommand,
});
