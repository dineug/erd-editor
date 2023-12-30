import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { isEmpty } from 'lodash-es';
import { debounceTime, Observable } from 'rxjs';

import { ChangeActionTypes } from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { actionsFilter } from '@/engine/rx-operators';
import { createStore } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { toSafeString } from '@/utils/validation';

type CompositionReplicationAction =
  | AnyAction
  | Array<CompositionReplicationAction>;
type CompositionReplicationActions = Array<CompositionReplicationAction>;

export type ReplicationStore = {
  readonly value: string;
  change$: Observable<Array<AnyAction>>;
  setInitialValue: (value: string) => void;
  dispatch: (...actions: CompositionReplicationActions) => void;
  dispatchSync: (...actions: CompositionReplicationActions) => void;
  destroy: () => void;
};

export function createReplicationStore(
  context: EngineContext
): ReplicationStore {
  const store = createStore(context, false);
  const hooks = createHooks(store);
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(actionsFilter(ChangeActionTypes), debounceTime(200));

  const setInitialValue = (value: string) => {
    const safeValue = toSafeString(value);
    store.dispatchSync(
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
  };

  const dispatchSync = (...actions: CompositionReplicationActions) => {
    store.dispatchSync(actions);
  };

  const dispatch = (...actions: CompositionReplicationActions) => {
    store.dispatch(actions);
  };

  const destroy = () => {
    store.destroy();
    hooks.destroy();
  };

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
