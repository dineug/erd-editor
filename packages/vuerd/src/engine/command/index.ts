import * as R from 'ramda';
import { merge, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Logger } from '@/core/logger';
import { commandsFilter } from '@/core/operators/commandsFilter';
import { notEmptyCommands } from '@/core/operators/notEmptyCommands';
import { changeCommandTypes } from '@/engine/command/helper';
import { ExecuteCommand } from '@/internal-types/command';
import { Command, CommandKey, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';

import { executeCanvasCommandMap } from './canvas.cmd';
import * as canvasCommand from './canvas.cmd.helper';
import { executeColumnCommandMap } from './column.cmd';
import * as columnCommand from './column.cmd.helper';
import { executeEditorCommandMap } from './editor.cmd';
import * as editorCommand from './editor.cmd.helper';
import { executeIndexCommandMap } from './index.cmd';
import * as indexCommand from './index.cmd.helper';
import { executeMemoCommandMap } from './memo.cmd';
import * as memoCommand from './memo.cmd.helper';
import { executeRelationshipCommandMap } from './relationship.cmd';
import * as relationshipCommand from './relationship.cmd.helper';
import { executeTableCommandMap } from './table.cmd';
import * as tableCommand from './table.cmd.helper';
import { executeTreeCommandMap } from './tree.cmd';
import * as treeCommand from './tree.cmd.helper';

const executeCommandMap: Record<CommandKey, ExecuteCommand> = {
  ...executeCanvasCommandMap,
  ...executeMemoCommandMap,
  ...executeTableCommandMap,
  ...executeColumnCommandMap,
  ...executeEditorCommandMap,
  ...executeRelationshipCommandMap,
  ...executeIndexCommandMap,
  ...executeTreeCommandMap,
};

export const createCommand = (): Command => ({
  canvas: canvasCommand,
  memo: memoCommand,
  table: tableCommand,
  column: columnCommand,
  editor: editorCommand,
  relationship: relationshipCommand,
  index: indexCommand,
  tree: treeCommand,
});

export function createStream() {
  const dispatch$ = new Subject<Array<CommandTypeAll>>();
  const history$ = new Subject<Array<CommandTypeAll>>();
  const change$ = merge(
    history$,
    dispatch$.pipe(commandsFilter(changeCommandTypes))
  ).pipe(notEmptyCommands, debounceTime(200));
  const hook$ = merge(history$, dispatch$).pipe(notEmptyCommands);

  return {
    dispatch$,
    history$,
    change$,
    hook$,
  };
}

function executeCommand$(state: State, commands: CommandTypeAll[]) {
  commands.forEach(command => {
    Logger.log('executeCommand =>', command.name);
    const execute = executeCommandMap[command.name];
    execute && execute(state, command.data as any);
  });
}

export const executeCommand = R.curry(
  (state: State, commands: CommandTypeAll[]) => {
    try {
      executeCommand$(state, commands);
    } catch (err) {
      Logger.error(err);
    }
  }
);
