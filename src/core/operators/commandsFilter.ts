import { CommandKey, CommandTypeAll } from '@@types/engine/command';
import { Observable } from 'rxjs';
import { notEmptyCommands } from '@/core/operators/notEmptyCommands';

export function commandsFilter(commandTypes: CommandKey[]) {
  const match = new RegExp(commandTypes.join('|'), 'i');

  return (source$: Observable<Array<CommandTypeAll>>) =>
    new Observable<Array<CommandTypeAll>>(subscriber =>
      source$.subscribe({
        next: commands =>
          subscriber.next(commands.filter(command => match.test(command.name))),
        error: value => subscriber.error(value),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyCommands);
}
