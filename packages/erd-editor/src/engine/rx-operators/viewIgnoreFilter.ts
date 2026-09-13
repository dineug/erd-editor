import { AnyAction } from '@dineug/r-html';
import { isNil } from 'es-toolkit';
import { Observable } from 'rxjs';

import { ViewIgnoreActionTypes } from '@/engine/actions';
import { SceneView } from '@/engine/modules/editor/state';
import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';

/**
 * Drops the document edits while a view is active, the way readonlyIgnoreFilter
 * drops them for a readonly host, so the view a reader stands in never writes
 * the document under it. A pass tag lets an action through regardless.
 */
export const viewIgnoreFilter = (
  getActiveView: () => SceneView | null,
  passTags: number[] = []
) => {
  const has = arrayHas<string>(ViewIgnoreActionTypes);
  const predicate = (action: AnyAction): boolean => {
    return (
      (!isNil(action.tags) && passTags.some(tag => bHas(action.tags!, tag))) ||
      !has(action.type)
    );
  };

  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          subscriber.next(
            getActiveView() ? actions.filter(predicate) : actions
          );
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    ).pipe(notEmptyActions);
};
