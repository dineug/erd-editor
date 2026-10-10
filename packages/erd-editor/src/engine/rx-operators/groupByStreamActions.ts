import { AnyAction } from '@dineug/r-html';
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
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';

const NONE_STREAM_KEY = '@@none-stream';

/**
 * A group's key and the types it takes, and optionally a tag that brings any
 * action carrying it into the group whatever its type.
 */
type Regroup = [string, Array<string> | ReadonlyArray<string>, number?];
type HasRegroup = [string, (action: AnyAction) => boolean];

/** Runs on a stream group's batches; each value it emits closes the buffer. */
export type StreamBufferOperator = MonoTypeOperatorFunction<Array<AnyAction>>;

const createToKey =
  (has: (type: string) => boolean, hasRegroups: HasRegroup[]) =>
  (action: AnyAction) => {
    const hasRegroup = hasRegroups.find(([, has]) => has(action));
    return hasRegroup
      ? hasRegroup[0]
      : has(action.type)
        ? action.type
        : NONE_STREAM_KEY;
  };

const hasTag = (action: AnyAction, tag?: number) =>
  tag !== undefined &&
  typeof action.tags === 'number' &&
  bHas(action.tags, tag);

export const groupByStreamActions = (
  streamActionTypes: Array<string> | ReadonlyArray<string>,
  regroups: Regroup[] = [],
  bufferClosingNotifierOperator: StreamBufferOperator = debounceTime(200)
) => {
  const has = arrayHas(streamActionTypes);
  const hasRegroups: HasRegroup[] = regroups.map(([key, types, tag]) => {
    const hasType = arrayHas(types);
    return [key, action => hasType(action.type) || hasTag(action, tag)];
  });
  const toKey = createToKey(has, hasRegroups);

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          const group = actions.reduce(
            (acc, action) => {
              const key = toKey(action);
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
      groupBy(actions => toKey(actions[0])),
      mergeMap(group$ =>
        group$.key === NONE_STREAM_KEY
          ? group$
          : group$.pipe(
              buffer(group$.pipe(bufferClosingNotifierOperator)),
              map(buff => buff.flat())
            )
      )
    );
};
