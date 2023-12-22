import * as R from 'ramda';

import { flat } from '@/core/helper';
import { Logger } from '@/core/logger';
import { History } from '@/internal-types/history';
import { IStore } from '@/internal-types/store';
import { BatchCommand, CommandTypeAll } from '@@types/engine/command';

import { executeCanvasCommandMap } from './canvas.cmd';
import { executeColumnCommandMap } from './column.cmd';
import { executeEditorCommandMap } from './editor.cmd';
import { executeMemoCommandMap } from './memo.cmd';
import { executeRelationshipCommandMap } from './relationship.cmd';
import { executeStreamCommandMap } from './stream.cmd';
import { executeTableCommandMap } from './table.cmd';

const executeCommandMap: any = {
  ...executeCanvasCommandMap,
  ...executeMemoCommandMap,
  ...executeTableCommandMap,
  ...executeColumnCommandMap,
  ...executeEditorCommandMap,
  ...executeRelationshipCommandMap,
};

function executeCommand(
  store: IStore,
  history: History,
  commands: CommandTypeAll[]
) {
  Logger.log(
    'executeHistoryCommand =>',
    commands.map(command => command.name).join(',')
  );
  const batchUndoCommand: BatchCommand = [];
  const batchRedoCommand: BatchCommand = [];

  commands.forEach(command => {
    const execute = executeCommandMap[command.name];
    if (!execute) return;

    execute(store, batchUndoCommand, command.data);
    batchRedoCommand.push(command);
  });

  Object.keys(executeStreamCommandMap).forEach(key =>
    executeStreamCommandMap[key as keyof typeof executeStreamCommandMap](
      commands,
      batchUndoCommand,
      batchRedoCommand
    )
  );

  if (!batchUndoCommand.length || !batchRedoCommand.length) return;

  history.push({
    undo: () =>
      store.history$.next([...flat<CommandTypeAll>(batchUndoCommand)]),
    redo: () =>
      store.history$.next([...flat<CommandTypeAll>(batchRedoCommand)]),
  });
}

export const executeHistoryCommand = R.curry(
  (store: IStore, history: History, commands: CommandTypeAll[]) => {
    try {
      executeCommand(store, history, commands);
    } catch (err) {
      Logger.error(err);
    }
  }
);
