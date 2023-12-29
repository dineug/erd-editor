import { AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import {
  buffer,
  debounceTime,
  groupBy,
  map,
  mergeMap,
  MonoTypeOperatorFunction,
  Observable,
} from 'rxjs';

import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';

const NONE_STREAM_KEY = '@@none-stream';

type Regroup = [string, Array<string> | ReadonlyArray<string>];
type HasRegroup = [string, (type: string) => boolean];

const createToKey =
  (has: (type: string) => boolean, hasRegroups: HasRegroup[]) =>
  (type: string) => {
    const hasRegroup = hasRegroups.find(([, has]) => has(type));
    return hasRegroup ? hasRegroup[0] : has(type) ? type : NONE_STREAM_KEY;
  };

export const groupByStreamActions = (
  streamActionTypes: Array<string> | ReadonlyArray<string>,
  regroups: Regroup[] = [],
  bufferClosingNotifierOperator: MonoTypeOperatorFunction<
    Array<AnyAction>
  > = debounceTime(200)
) => {
  const has = arrayHas(streamActionTypes);
  const hasRegroups: HasRegroup[] = regroups.map(([key, types]) => [
    key,
    arrayHas(types),
  ]);
  const toKey = createToKey(has, hasRegroups);

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          const group = actions.reduce(
            (acc, action) => {
              const key = toKey(action.type);
              if (!acc[key]) {
                acc[key] = [];
              }

              acc[key].push(action);
              return acc;
            },
            {} as Record<string, Array<AnyAction>>
          );

          Object.values(group).forEach(actions => subscriber.next(actions));
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(
      notEmptyActions,
      groupBy(actions => toKey(actions[0].type)),
      mergeMap(group$ =>
        group$.key === NONE_STREAM_KEY
          ? group$
          : group$.pipe(
              buffer(group$.pipe(bufferClosingNotifierOperator)),
              map(buff => buff.flat(2))
            )
      )
    );
};
