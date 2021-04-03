import { Command, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { Subject, merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as R from 'ramda';
import * as canvasCommand from './canvas.cmd.helper';
import * as memoCommand from './memo.cmd.helper';
import * as tableCommand from './table.cmd.helper';
import * as columnCommand from './column.cmd.helper';
import * as editorCommand from './editor.cmd.helper';
import * as relationshipCommand from './relationship.cmd.helper';
import * as indexCommand from './index.cmd.helper';
import { Logger } from '@/core/logger';
import { executeCanvasCommandMap } from './canvas.cmd';
import { executeMemoCommandMap } from './memo.cmd';
import { executeTableCommandMap } from './table.cmd';
import { executeColumnCommandMap } from './column.cmd';
import { executeEditorCommandMap } from './editor.cmd';
import { executeRelationshipCommandMap } from './relationship.cmd';
import { executeIndexCommandMap } from './index.cmd';
import { useHooks } from '@/engine/hooks';
import { changeCommandTypes } from '@/engine/command/helper';
import { commandsFilter } from '@/core/operators/commandsFilter';
import { notEmptyCommands } from '@/core/operators/notEmptyCommands';

const executeCommandMap = {
  ...executeCanvasCommandMap,
  ...executeMemoCommandMap,
  ...executeTableCommandMap,
  ...executeColumnCommandMap,
  ...executeEditorCommandMap,
  ...executeRelationshipCommandMap,
  ...executeIndexCommandMap,
};

export const createCommand = (): Command => ({
  canvas: canvasCommand,
  memo: memoCommand,
  table: tableCommand,
  column: columnCommand,
  editor: editorCommand,
  relationship: relationshipCommand,
  index: indexCommand,
});

export function createStream() {
  const dispatch$ = new Subject<Array<CommandTypeAll>>();
  const history$ = new Subject<Array<CommandTypeAll>>();
  const change$ = merge(
    history$,
    dispatch$.pipe(commandsFilter(changeCommandTypes))
  ).pipe(notEmptyCommands, debounceTime(200));

  return {
    dispatch$,
    history$,
    change$,
  };
}

export const executeCommand = R.curry(
  (state: State, commands: CommandTypeAll[]) =>
    commands.forEach(command => {
      Logger.log('executeCommand =>', command.name);
      const execute = executeCommandMap[command.name];
      execute && execute(state, command.data as any);
      useHooks(state, command.name);
    })
);
