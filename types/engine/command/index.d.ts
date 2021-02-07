import { CanvasCommandMap } from './canvas.command';
import * as CanvasCommand from './canvas.command.helper';
import { MemoCommandMap } from './memo.command';
import * as MemoCommand from './memo.command.helper';

export interface CommandMap extends CanvasCommandMap, MemoCommandMap {}

export type CommandKey = keyof CommandMap;

export interface CommandType<K extends CommandKey> {
  name: K;
  data: CommandMap[K];
}

export interface CommandTypeAny {
  name: string;
  data: any;
}

export type CommandTypeAll = CommandType<CommandKey>;

export interface Command {
  canvas: typeof CanvasCommand;
  memo: typeof MemoCommand;
}
