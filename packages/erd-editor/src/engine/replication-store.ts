import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { asap, safeCallback } from '@dineug/shared';
import { isEmpty, omit } from 'lodash-es';
import { debounceTime, map, Observable, Subject, Subscription } from 'rxjs';

import { ChangeActionTypes } from '@/engine/actions';
import {
  createEngineContext,
  type InjectEngineContext,
} from '@/engine/context';
import { validationIdsAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { actionsFilter } from '@/engine/rx-operators';
import { createStore } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { Unsubscribe, ValuesType } from '@/internal-types';
import { procGC } from '@/services/schema-gc/procGC';
import { SchemaGCService } from '@/services/schema-gc/schemaGCService';
import { toSafeString } from '@/utils/validation';

type ListenerRecord = {
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
  on: (listeners: Partial<ListenerRecord>) => Unsubscribe;
  setInitialValue: (value: string) => void;
  dispatch: (actions: Array<AnyAction> | AnyAction) => void;
  dispatchSync: (actions: Array<AnyAction> | AnyAction) => void;
  destroy: () => void;
};

export function createReplicationStore(
  context: InjectEngineContext
): ReplicationStore {
  const subscriptionSet = new Set<Subscription>();
  const engineContext = createEngineContext(context);
  const store = createStore(engineContext, false);
  const hooks = createHooks(store);
  const dispatch$ = new Subject<Array<AnyAction>>();
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(actionsFilter(ChangeActionTypes), debounceTime(200));
  const observers = new Set<Partial<ListenerRecord>>();
  const schemaGCService = new SchemaGCService();

  const on = (listeners: Partial<ListenerRecord>): Unsubscribe => {
    observers.has(listeners) || observers.add(listeners);

    return () => {
      observers.delete(listeners);
    };
  };

  const emit = <T extends InternalActionType>(
    type: T,
    payload: InternalActionMap[T]
  ) => {
    observers.forEach(listeners => {
      const listener = Reflect.get(listeners, type);
      safeCallback(listener, payload);
    });
  };

  const setInitialValue = (value: string) => {
    const safeValue = toSafeString(value);
    store.dispatchSync(
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
    schemaGCService.run(toJson(store.state)).then(gcIds => {
      const isChange =
        gcIds.tableIds.length ||
        gcIds.tableColumnIds.length ||
        gcIds.relationshipIds.length ||
        gcIds.indexIds.length ||
        gcIds.indexColumnIds.length ||
        gcIds.memoIds.length;

      if (isChange) {
        procGC(store.state, gcIds);
        store.dispatchSync(validationIdsAction());
      }
    });
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
