import { CanvasCommandMap } from './canvas.cmd';
import * as CanvasCommand from './canvas.cmd.helper';
import { ColumnCommandMap } from './column.cmd';
import * as ColumnCommand from './column.cmd.helper';
import { EditorCommandMap } from './editor.cmd';
import * as EditorCommand from './editor.cmd.helper';
import { IndexCommandMap } from './index.cmd';
import * as IndexCommand from './index.cmd.helper';
import { MemoCommandMap } from './memo.cmd';
import * as MemoCommand from './memo.cmd.helper';
import { RelationshipCommandMap } from './relationship.cmd';
import * as RelationshipCommand from './relationship.cmd.helper';
import { TableCommandMap } from './table.cmd';
import * as TableCommand from './table.com.helper';
import { TreeCommandMap } from './tree.cmd';
import * as TreeCommand from './tree.cmd.helper';

export interface CommandMap
  extends CanvasCommandMap,
    MemoCommandMap,
    TableCommandMap,
    ColumnCommandMap,
    EditorCommandMap,
    RelationshipCommandMap,
    IndexCommandMap,
    TreeCommandMap {}

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

export type RecursionGenerator<T> = Generator<T | RecursionGenerator<T>>;

export type BatchCommand<T = CommandTypeAll> = Array<T | RecursionGenerator<T>>;

export interface Command {
  canvas: typeof CanvasCommand;
  memo: typeof MemoCommand;
  table: typeof TableCommand;
  column: typeof ColumnCommand;
  editor: typeof EditorCommand;
  relationship: typeof RelationshipCommand;
  index: typeof IndexCommand;
  tree: typeof TreeCommand;
}
