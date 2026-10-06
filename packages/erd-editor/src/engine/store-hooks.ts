import { type AnyAction } from '@dineug/r-html';
import { Subject, Subscription } from 'rxjs';

import type { EngineContext } from '@/engine/context';
import {
  hooks as relationshipHooks,
  recalculateIdentification,
  recalculateStartRelationshipType,
} from '@/engine/modules/relationship/hooks';
import { hooks as tableHooks } from '@/engine/modules/table/hooks';
import {
  hooks as tableColumnHooks,
  validateForeignKeys,
} from '@/engine/modules/table-column/hooks';
import type { RootState } from '@/engine/state';
import type { Store } from '@/engine/store';
import { arrayHas } from '@/utils/arrayHas';
import { recalculateTableWidth } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

type Task = {
  pattern: ReturnType<typeof arrayHas<string>>;
  action$: Subject<AnyAction>;
  subscription: Subscription;
};

const hooks = [...tableHooks, ...tableColumnHooks, ...relationshipHooks];

export function createHooks(store: Store) {
  const getState = () => store.state;

  const tasks: Task[] = hooks.map(([pattern, hook]) => {
    const action$ = new Subject<AnyAction>();

    return {
      pattern: arrayHas(pattern.map(String)),
      action$,
      subscription: hook(action$, getState, store.context),
    };
  });

  const unsubscribe = store.subscribe(actions => {
    for (const action of actions) {
      for (const task of tasks) {
        if (task.pattern(action.type)) {
          task.action$.next(action);
        }
      }
    }
  });

  const destroy = () => {
    tasks.forEach(({ action$, subscription }) => {
      subscription.unsubscribe();
      action$.complete();
    });
    tasks.splice(0, tasks.length);
    unsubscribe();
  };

  return { destroy };
}

/**
 * Writes at once what the hooks a load wakes write over the next 5 ms, which
 * then find nothing left to write, so a replica measuring changes from its load
 * does not take them for an edit.
 */
export function settleLoad(state: RootState, ctx: EngineContext) {
  validateForeignKeys(state);
  recalculateTableWidth(state, ctx);
  relationshipSort(state);
  recalculateIdentification(state);
  recalculateStartRelationshipType(state);
}
