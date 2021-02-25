import { CanvasCommandMap } from './canvas.cmd';
import { MemoCommandMap } from './memo.cmd';
import { TableCommandMap } from './table.cmd';
import { ColumnCommandMap } from './column.cmd';
import { EditorCommandMap } from './editor.cmd';
import * as CanvasCommand from './canvas.cmd.helper';
import * as MemoCommand from './memo.cmd.helper';
import * as TableCommand from './table.com.helper';
import * as ColumnCommand from './column.cmd.helper';
import * as EditorCommand from './editor.cmd.helper';

export interface CommandMap
  extends CanvasCommandMap,
    MemoCommandMap,
    TableCommandMap,
    ColumnCommandMap,
    EditorCommandMap {}

export type CommandKey = keyof CommandMap;

export interface CommandType<K extends CommandKey> {
  name: K;
  data: CommandMap[K];
  timestamp: number;
}

export interface CommandTypeAny {
  name: string;
  data: any;
  timestamp: number;
}

export type CommandTypeAll = CommandType<CommandKey>;

export interface Command {
  canvas: typeof CanvasCommand;
  memo: typeof MemoCommand;
  table: typeof TableCommand;
  column: typeof ColumnCommand;
  editor: typeof EditorCommand;
}
