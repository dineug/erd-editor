import { AnyAction } from '@dineug/r-html';
import { Observable } from 'rxjs';

import { notEmptyActions } from '@/engine/operators/notEmptyActions';

export const actionsFilter =
  (actionTypes: string[]) => (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions =>
          subscriber.next(
            actions.filter(action => actionTypes.includes(action.type))
          ),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
