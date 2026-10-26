import { AnyAction } from '@dineug/r-html';
import { isNil } from 'es-toolkit';
import { Observable } from 'rxjs';

import { ReadonlyIgnoreActionTypes } from '@/engine/actions';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';

const dropsNothingElse = () => false;

/**
 * Drops the edits a readonly host refuses while it is readonly: the
 * ReadonlyIgnoreActionTypes, the extra types given and each action the extra
 * predicate names. An action that carries a pass tag goes through regardless.
 */
export const readonlyIgnoreFilter = (
  getReadonly: () => boolean,
  passTags: number[] = [],
  extraTypes: ReadonlyArray<string> = [],
  dropsAlso: (action: AnyAction) => boolean = dropsNothingElse
) => {
  const has = arrayHas<string>([...ReadonlyIgnoreActionTypes, ...extraTypes]);
  const predicate = (action: AnyAction): boolean => {
    return (
      (!isNil(action.tags) && passTags.some(tag => bHas(action.tags!, tag))) ||
      !(has(action.type) || dropsAlso(action))
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
