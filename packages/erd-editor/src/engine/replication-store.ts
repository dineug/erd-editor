import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { asap, safeCallback } from '@dineug/shared';
import { isEmpty, omit } from 'lodash-es';
import { debounceTime, map, Observable, Subject, Subscription } from 'rxjs';

import { ChangeActionTypes } from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { actionsFilter } from '@/engine/rx-operators';
import { createStore } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { Unsubscribe, ValuesType } from '@/internal-types';
import { toSafeString } from '@/utils/validation';

type ReducerRecord = {
  [P in keyof InternalActionMap]: (payload: InternalActionMap[P]) => void;
};

const InternalActionType = {
  change: 'change',
} as const;
type InternalActionType = ValuesType<typeof InternalActionType>;
type InternalActionMap = {
  [InternalActionType.change]: void;
};

export type ReplicationStore = {
  readonly value: string;
  on: (reducers: Partial<ReducerRecord>) => Unsubscribe;
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
  const observers = new Set<Partial<ReducerRecord>>();

  const on = (reducers: Partial<ReducerRecord>): Unsubscribe => {
    observers.has(reducers) || observers.add(reducers);

    return () => {
      observers.delete(reducers);
    };
  };

  const emit = <T extends InternalActionType>(
    type: T,
    payload: InternalActionMap[T]
  ) => {
    observers.forEach(reducers => {
      const reducer = Reflect.get(reducers, type);
      safeCallback(reducer, payload);
    });
  };

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
    observers.clear();
    store.destroy();
    hooks.destroy();
  };

  subscriptionSet
    .add(change$.subscribe(() => emit(InternalActionType.change, undefined)))
    .add(
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
    on,
    setInitialValue,
    dispatch,
    dispatchSync,
    destroy,
  });
}
