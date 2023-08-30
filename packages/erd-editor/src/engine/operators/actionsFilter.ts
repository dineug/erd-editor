import { AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { Observable } from 'rxjs';

import { notEmptyActions } from '@/engine/operators/notEmptyActions';

export const actionsFilter = (
  actionTypes: Array<string> | ReadonlyArray<string>
) => {
  const has = arrayHas(actionTypes);

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions =>
          subscriber.next(actions.filter(action => has(action.type))),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
};
