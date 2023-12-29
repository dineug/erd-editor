import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { asap } from '@dineug/shared';
import { debounceTime, Observable, Subject, Subscription } from 'rxjs';

import { ChangeActionTypes } from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { actionsFilter } from '@/engine/rx-operators';
import { createStore, Store } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';

export type RxStoreReplication = Store & {
  change$: Observable<Array<AnyAction>>;
};

export function createRxStoreReplication(
  context: EngineContext
): RxStoreReplication {
  const subscriptionSet = new Set<Subscription>();
  const store = createStore(context, false);
  const hooks = createHooks(store);
  const dispatch$ = new Subject<Array<AnyAction>>();
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(actionsFilter(ChangeActionTypes), debounceTime(200));

  const dispatchSync = (...compositionActions: CompositionActions) => {
    dispatch$.next(
      compositionActionsFlat(store.state, store.context, compositionActions)
    );
  };
  const dispatch = (...compositionActions: CompositionActions) => {
    asap(() => dispatchSync(compositionActions));
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
    store.destroy();
    hooks.destroy();
  };

  subscriptionSet.add(dispatch$.subscribe(store.dispatchSync));

  return Object.freeze({
    ...store,
    dispatch,
    dispatchSync,
    destroy,
    change$,
  });
}
