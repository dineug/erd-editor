import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { asap } from '@dineug/shared';
import { isEmpty, omit } from 'lodash-es';
import { debounceTime, map, Observable, Subject, Subscription } from 'rxjs';

import { ChangeActionTypes } from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { actionsFilter } from '@/engine/rx-operators';
import { createStore } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { toSafeString } from '@/utils/validation';

export type ReplicationStore = {
  readonly value: string;
  change$: Observable<Array<AnyAction>>;
  setInitialValue: (value: string) => void;
  dispatch: (actions: Array<AnyAction> | AnyAction) => void;
  dispatchSync: (actions: Array<AnyAction> | AnyAction) => void;
  destroy: () => void;
};

export function createReplicationStore(
  context: EngineContext
): ReplicationStore {
  const subscriptionSet = new Set<Subscription>();
  const store = createStore(context, false);
  const hooks = createHooks(store);
  const dispatch$ = new Subject<Array<AnyAction>>();
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(actionsFilter(ChangeActionTypes), debounceTime(200));

  const setInitialValue = (value: string) => {
    const safeValue = toSafeString(value);
    store.dispatchSync(
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
  };

  const dispatchSync = (actions: Array<AnyAction> | AnyAction) => {
    dispatch$.next([actions].flat());
  };

  const dispatch = (actions: Array<AnyAction> | AnyAction) => {
    asap(() => dispatchSync(actions));
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
    store.destroy();
    hooks.destroy();
  };

  subscriptionSet.add(
    dispatch$
      .pipe(
        actionsFilter(ChangeActionTypes),
        map(actions => actions.map(action => omit(action, 'tags')))
      )
      .subscribe(store.dispatchSync)
  );

  return Object.freeze({
    get value() {
      return toJson(store.state);
    },
    change$,
    setInitialValue,
    dispatch,
    dispatchSync,
    destroy,
  });
}
