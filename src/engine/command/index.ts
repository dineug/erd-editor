import { Command, CommandKey, CommandType } from '@@types/engine/command';
import { Subject, merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as CanvasCommand from './canvas.command.helper';

export const createCommand = (): Command => ({
  canvas: CanvasCommand,
});

export function createStream() {
  const dispatch$ = new Subject<Array<CommandType<CommandKey>>>();
  const undo$ = new Subject<Array<CommandType<CommandKey>>>();
  const change$ = merge(undo$, dispatch$).pipe(debounceTime(200));

  return {
    dispatch$,
    undo$,
    change$,
  };
}
