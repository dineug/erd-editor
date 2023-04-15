import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { debounceTime, merge, Observable, Subject, Subscription } from 'rxjs';

import { EngineContext } from '@/engine/context';
import {
  actionsFilter,
  groupByStreamActions,
  notEmptyActions,
} from '@/engine/operators';
import { createStore, Store } from '@/engine/store';

export type RxStore = Store & {
  change$: Observable<Array<AnyAction>>;
};

export function createRxStore(context: EngineContext): RxStore {
  const store = createStore(context);
  const dispatch$ = new Subject<Array<AnyAction>>();
  const history$ = new Subject<Array<AnyAction>>();
  const change$ = merge(
    history$,
    dispatch$.pipe(
      actionsFilter([]) // TODO: changeActionTypes
    )
  ).pipe(notEmptyActions, debounceTime(200));
  const subscriptions: Subscription[] = [];

  const getActions = (...compositionActions: CompositionActions) =>
    compositionActionsFlat(store.state, context, compositionActions);

  const dispatchSync = (...compositionActions: CompositionActions) => {
    dispatch$.next(getActions(compositionActions));
  };

  const dispatch = (...compositionActions: CompositionActions) => {
    queueMicrotask(() => dispatchSync(compositionActions));
  };

  const destroy = () => {
    subscriptions.forEach(sub => sub.unsubscribe());
    store.destroy();
  };

  const run = (actions: AnyAction[]) => {
    store.dispatchSync(actions);
  };

  subscriptions.push(
    history$.pipe(notEmptyActions).subscribe(run),
    dispatch$
      .pipe(
        actionsFilter([]), // TODO: historyActionTypes
        groupByStreamActions([]) // TODO: streamActionTypes
      )
      .subscribe(() => {
        // TODO: history stack
      }),
    dispatch$.subscribe(run)
  );

  return {
    ...store,
    dispatch,
    dispatchSync,
    destroy,
    change$,
  };
}
