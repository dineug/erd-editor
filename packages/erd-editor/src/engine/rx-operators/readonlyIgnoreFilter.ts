import { AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { Observable } from 'rxjs';

import { ReadonlyIgnoreActionTypes } from '@/engine/actions';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';

export const readonlyIgnoreFilter = (getReadonly: () => boolean) => {
  const has = arrayHas<string>(ReadonlyIgnoreActionTypes);

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          subscriber.next(
            getReadonly()
              ? actions.filter(action => !has(action.type))
              : actions
          );
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
};
