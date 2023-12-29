import { AnyAction } from '@dineug/r-html';
import { isNill } from '@dineug/shared';
import { Observable } from 'rxjs';

import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { bHas } from '@/utils/bit';

export const ignoreTagFilter = (tags: number[]) => {
  const predicate = (action: AnyAction): boolean => {
    return isNill(action.tags) || !tags.some(tag => bHas(action.tags!, tag));
  };

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => subscriber.next(actions.filter(predicate)),
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
};
