import { CanvasCommandMap } from './canvas.cmd';
import { MemoCommandMap } from './memo.cmd';
import { TableCommandMap } from './table.cmd';
import * as CanvasCommand from './canvas.cmd.helper';
import * as MemoCommand from './memo.cmd.helper';
import * as TableCommand from './table.com.helper';

export interface CommandMap
  extends CanvasCommandMap,
    MemoCommandMap,
    TableCommandMap {}

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
  table: typeof TableCommand;
}
