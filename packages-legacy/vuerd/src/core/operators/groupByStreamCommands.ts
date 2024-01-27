import { Observable } from 'rxjs';
import { buffer, debounceTime, groupBy, map, mergeMap } from 'rxjs/operators';

import { notEmptyCommands } from '@/core/operators/notEmptyCommands';
import { streamCommandTypes } from '@/engine/command/helper';
import { CommandTypeAll } from '@@types/engine/command';

const NONE_STREAM_KEY = '@@none-stream';

type Regroup = [string, Array<string> | ReadonlyArray<string>];
type HasRegroup = [string, (type: string) => boolean];

const createToKey =
  (has: (type: string) => boolean, hasRegroups: HasRegroup[]) =>
  (type: string) => {
    const hasRegroup = hasRegroups.find(([, has]) => has(type));
    return hasRegroup ? hasRegroup[0] : has(type) ? type : NONE_STREAM_KEY;
  };

export const groupByStreamCommands = (regroups: Regroup[] = []) => {
  const has = arrayHas<string>(streamCommandTypes);
  const hasRegroups: HasRegroup[] = regroups.map(([key, types]) => [
    key,
    arrayHas(types),
  ]);
  const toKey = createToKey(has, hasRegroups);

  return (source$: Observable<Array<CommandTypeAll>>) =>
    new Observable<Array<CommandTypeAll>>(subscriber =>
      source$.subscribe({
        next: commands => {
          const group = commands.reduce(
            (acc, command) => {
              const key = toKey(command.name);
              if (!acc[key]) {
                acc[key] = [];
              }

              acc[key].push(command);
              return acc;
            },
            {} as Record<string, Array<CommandTypeAll>>
          );

          Object.values(group).forEach(commands => subscriber.next(commands));
        },
        error: value => subscriber.error(value),
        complete: () => subscriber.complete(),
      })
    ).pipe(
      notEmptyCommands,
      groupBy(commands => toKey(commands[0].name)),
      mergeMap(group$ =>
        group$.key === NONE_STREAM_KEY
          ? group$
          : group$.pipe(
              buffer(group$.pipe(debounceTime(200))),
              map(buff => buff.reduce((acc, cur) => acc.concat(cur), []))
            )
      )
    );
};

function arrayHas<T>(arr: Array<T> | ReadonlyArray<T>) {
  const set = new Set(arr);
  return (value: T): boolean => set.has(value);
}
