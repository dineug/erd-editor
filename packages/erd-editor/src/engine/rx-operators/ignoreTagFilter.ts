import { AnyAction } from '@dineug/r-html';
import { isNill } from '@dineug/shared';
import { Observable } from 'rxjs';

import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { bHas } from '@/utils/bit';

export const ignoreTagFilter =
  (tag: number) => (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions =>
          subscriber.next(
            actions.filter(
              action => isNill(action.tags) || !bHas(action.tags, tag)
            )
          ),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
