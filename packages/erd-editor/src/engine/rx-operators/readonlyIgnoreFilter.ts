import { AnyAction } from '@dineug/r-html';
import { arrayHas, isNill } from '@dineug/shared';
import { Observable } from 'rxjs';

import { ReadonlyIgnoreActionTypes } from '@/engine/actions';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { bHas } from '@/utils/bit';

export const readonlyIgnoreFilter = (
  getReadonly: () => boolean,
  passTags: number[] = []
) => {
  const has = arrayHas<string>(ReadonlyIgnoreActionTypes);
  const predicate = (action: AnyAction): boolean => {
    return (
      (!isNill(action.tags) && passTags.some(tag => bHas(action.tags!, tag))) ||
      !has(action.type)
    );
  };

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          subscriber.next(getReadonly() ? actions.filter(predicate) : actions);
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
};
