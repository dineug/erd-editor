import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { omit } from 'es-toolkit';
import { debounceTime, map, Observable, Subject, Subscription } from 'rxjs';

import { ChangeActionTypes } from '@/engine/actions';
import {
  createEngineContext,
  type InjectEngineContext,
} from '@/engine/context';
import {
  changeViewportAction,
  validationIdsAction,
} from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { actionsFilter, notEmptyActions } from '@/engine/rx-operators';
import { createStore } from '@/engine/store';
import { createHooks, settleLoad } from '@/engine/store-hooks';
import { Unsubscribe, ValuesType } from '@/internal-types';
import { procGC } from '@/services/schema-gc/procGC';
import { collectGCIds } from '@/services/schema-gc/schemaGCService';
import { toLoadValue } from '@/utils/loadValue';
import { safeCallback } from '@/utils/safeCallback';

type ListenerRecord = {
  [P in keyof InternalActionMap]: (payload: InternalActionMap[P]) => void;
};

const InternalActionType = {
  change: 'change',
} as const;
type InternalActionType = ValuesType<typeof InternalActionType>;
type InternalActionMap = {
  [InternalActionType.change]: ReplicationChange;
};

/**
 * What a change hands its listeners: the document serialized, and whether the
 * change actions since the last change, or since the load, left it byte for
 * byte as it was, as a scroll or a zoom the file does not save does.
 */
export type ReplicationChange = {
  value: string;
  changed: boolean;
};

export type ReplicationStore = {
  readonly value: string;
  /**
   * A change comes 200 ms after the last change action, even one that left the
   * value as it was (changed false): a hub waits for each as a save, and a host
   * writes nothing for such a one, whatever bytes its file holds.
   */
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
  // A replica has no screen, and the default editor size the store starts with
  // would pull every replicated load against a frame nobody looks through, so
  // the viewport is reported empty before anything can be reduced against it.
  store.dispatchSync(changeViewportAction({ width: 0, height: 0 }));
  const hooks = createHooks(store);
  const dispatch$ = new Subject<Array<AnyAction>>();
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(actionsFilter(ChangeActionTypes), debounceTime(200));
  const observers = new Set<Partial<ListenerRecord>>();
  // What a change is measured against: the value the last one handed out, or
  // after a load the value the first change action finds, which holds the
  // load's own rewrites (the GC, text widths, flags). A file is no measure.
  let baseline: string | null = null;

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

  // The load's own rewrites, made before it returns rather than on the GC's
  // promise and the hooks' timers, so a change action that comes at once, as a
  // pan replayed behind the load does, finds them in.
  const setInitialValue = (value: string) => {
    baseline = null;
    store.dispatchSync(initialLoadJsonAction$(toLoadValue(value)));

    const gcIds = collectGCIds(toJson(store.state));
    if (Object.values(gcIds).some(ids => ids.length)) {
      procGC(store.state, gcIds);
      store.dispatchSync(validationIdsAction());
    }
    settleLoad(store.state, engineContext);
  };

  const dispatchSync = (actions: Array<AnyAction> | AnyAction) => {
    dispatch$.next([actions].flat());
  };

  const dispatch = (actions: Array<AnyAction> | AnyAction) => {
    queueMicrotask(() => dispatchSync(actions));
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
    observers.clear();
    store.destroy();
    hooks.destroy();
  };

  const handleChange = () => {
    const value = toJson(store.state);
    // Null after a load that came while a change was pending, whose value is
    // what loaded.
    const changed = baseline !== null && value !== baseline;
    if (baseline !== null) baseline = value;
    emit(InternalActionType.change, { value, changed });
  };

  subscriptionSet.add(change$.subscribe(handleChange)).add(
    dispatch$
      .pipe(
        actionsFilter(ChangeActionTypes),
        notEmptyActions,
        map(actions => actions.map(action => omit(action, ['tags'])))
      )
      .subscribe(actions => {
        baseline ??= toJson(store.state);
        store.dispatchSync(actions);
      })
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
