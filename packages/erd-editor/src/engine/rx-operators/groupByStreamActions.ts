import { AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { buffer, debounceTime, groupBy, map, mergeMap, Observable } from 'rxjs';

import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';

const NONE_STREAM_KEY = '@@none-stream';

export const groupByStreamActions = (
  streamActionTypes: Array<string> | ReadonlyArray<string>
) => {
  const has = arrayHas(streamActionTypes);

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          const group = actions.reduce(
            (acc, action) => {
              const type = has(action.type) ? action.type : NONE_STREAM_KEY;
              if (!acc[type]) {
                acc[type] = [];
              }

              acc[type].push(action);
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
      groupBy(actions => {
        const type = actions[0].type;
        return has(type) ? type : NONE_STREAM_KEY;
      }),
      mergeMap(group$ =>
        group$.key === NONE_STREAM_KEY
          ? group$
          : group$.pipe(
              buffer(group$.pipe(debounceTime(200))),
              map(buff => buff.flat(2))
            )
      )
    );
};
