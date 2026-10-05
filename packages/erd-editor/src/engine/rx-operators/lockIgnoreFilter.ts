import { AnyAction } from '@dineug/r-html';
import { Observable } from 'rxjs';

import { LockSettingActionTypes } from '@/engine/actions';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { bHas } from '@/utils/bit';

/**
 * Drops each setting action whose lock is on, read as the batch passes: it
 * moved the screen alone, since the file keeps the value the lock holds.
 */
export const lockIgnoreFilter = (getLockSettings: () => number) => {
  const predicate = (lockSettings: number) => (action: AnyAction) => {
    const lock = Reflect.get(LockSettingActionTypes, action.type);
    return !lock || !bHas(lockSettings, lock);
  };

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          subscriber.next(actions.filter(predicate(getLockSettings())));
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
};
