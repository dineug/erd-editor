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
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { createStore, Store } from '@/engine/store';
import { createHooks } from '@/engine/store.hooks';
import { Tag } from '@/engine/tag';

export type RxStore = Store & {
  undo: () => void;
  redo: () => void;
  change$: Observable<Array<AnyAction>>;
};

const HISTORY_LIMIT = 2048;

export function createRxStore(context: EngineContext): RxStore {
  const subscriptions: Subscription[] = [];
  const store = createStore(context);
  const hooks = createHooks(store);
  const history = createHistory(payload =>
    store.dispatch(changeHasHistoryAction(payload))
  );
  history.setLimit(HISTORY_LIMIT);

  const dispatch$ = new Subject<Array<AnyAction>>();
  const history$ = dispatch$.pipe(
    actionsFilter(HistoryActionTypes),
    ignoreTagFilter(Tag.shared),
    groupByStreamActions(StreamActionTypes)
  );
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
    subscriptions.forEach(sub => sub.unsubscribe());
    store.destroy();
    hooks.destroy();
    history.clear();
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

  return Object.freeze({
    ...store,
    dispatch,
    dispatchSync,
    destroy,
    undo,
    redo,
    change$,
  });
}
