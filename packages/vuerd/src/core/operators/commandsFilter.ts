import { CommandKey, CommandTypeAll } from '@@types/engine/command';
import { Observable } from 'rxjs';
import { notEmptyCommands } from '@/core/operators/notEmptyCommands';

export const commandsFilter = (commandTypes: CommandKey[]) => (
  source$: Observable<Array<CommandTypeAll>>
) =>
  new Observable<Array<CommandTypeAll>>(subscriber =>
    source$.subscribe({
      next: commands =>
        subscriber.next(
          commands.filter(command => commandTypes.includes(command.name))
        ),
      error: value => subscriber.error(value),
      complete: () => subscriber.complete(),
    })
  ).pipe(notEmptyCommands);
