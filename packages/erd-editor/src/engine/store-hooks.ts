import { type AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { Subject, Subscription } from 'rxjs';

import { hooks as relationshipHooks } from '@/engine/modules/relationship/hooks';
import { hooks as tableHooks } from '@/engine/modules/table/hooks';
import { hooks as tableColumnHooks } from '@/engine/modules/table-column/hooks';
import type { Store } from '@/engine/store';

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
