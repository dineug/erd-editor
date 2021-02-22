import { Command, CommandTypeAll } from '@@types/engine/command';
import { State } from '@@types/engine/store';
import { Subject, merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as R from 'ramda';
import { Logger } from '@/core/logger';
import * as CanvasCommand from './canvas.cmd.helper';
import * as MemoCommand from './memo.cmd.helper';
import * as TableCommand from './table.cmd.helper';
import * as ColumnCommand from './column.cmd.helper';
import { executeCanvasCommandMap } from './canvas.cmd';
import { executeMemoCommandMap } from './memo.cmd';
import { executeTableCommandMap } from './table.cmd';
import { executeColumnCommandMap } from './column.cmd';

const executeCommandMap = {
  ...executeCanvasCommandMap,
  ...executeMemoCommandMap,
  ...executeTableCommandMap,
  ...executeColumnCommandMap,
};

export const createCommand = (): Command => ({
  canvas: CanvasCommand,
  memo: MemoCommand,
  table: TableCommand,
  column: ColumnCommand,
});

export function createStream() {
  const dispatch$ = new Subject<Array<CommandTypeAll>>();
  const history$ = new Subject<Array<CommandTypeAll>>();
  const change$ = merge(history$, dispatch$).pipe(debounceTime(200));

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
    })
);
