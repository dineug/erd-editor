import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { asap } from '@dineug/shared';
import { debounceTime, Observable, Subject, Subscription } from 'rxjs';

import {
  ChangeActionTypes,
  HistoryActionTypes,
  StreamActionTypes,
} from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { createHistory } from '@/engine/history';
import { pushHistory } from '@/engine/history.actions';
import { changeHasHistoryAction } from '@/engine/modules/editor/atom.actions';
import {
  actionsFilter,
  groupByStreamActions,
  notEmptyActions,
} from '@/engine/operators';
import { createStore, Store } from '@/engine/store';

export type RxStore = Store & {
  undo: () => void;
  redo: () => void;
  change$: Observable<Array<AnyAction>>;
};

export function createRxStore(context: EngineContext): RxStore {
  const subscriptions: Subscription[] = [];
  const store = createStore(context);
  const history = createHistory(payload =>
    store.dispatch(changeHasHistoryAction(payload))
  );

  const dispatch$ = new Subject<Array<AnyAction>>();
  const history$ = dispatch$.pipe(
    actionsFilter(HistoryActionTypes),
    groupByStreamActions(StreamActionTypes)
  );
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(actionsFilter(ChangeActionTypes), notEmptyActions, debounceTime(200));

  const dispatchSync = (...compositionActions: CompositionActions) => {
    dispatch$.next(
      compositionActionsFlat(store.state, store.context, compositionActions)
    );
  };
  const dispatch = (...compositionActions: CompositionActions) => {
    asap(() => dispatchSync(compositionActions));
  };

  const destroy = () => {
    subscriptions.forEach(sub => sub.unsubscribe());
    store.destroy();
  };

  const undo = () => {
    history.undo();
  };
  const redo = () => {
    history.redo();
  };

  subscriptions.push(
    history$.subscribe(pushHistory(store, history)),
    dispatch$.subscribe(store.dispatchSync)
  );

  return {
    ...store,
    dispatch,
    dispatchSync,
    destroy,
    undo,
    redo,
    change$,
  };
}
