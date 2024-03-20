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
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
} from '@/engine/actions';
import { EngineContext } from '@/engine/context';
import { createHistory, History, HistoryOptions } from '@/engine/history';
import { pushHistory } from '@/engine/history.actions';
import { changeHasHistoryAction } from '@/engine/modules/editor/atom.actions';
import {
  actionsFilter,
  groupByStreamActions,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import { createStore, Store } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { Tag } from '@/engine/tag';

export type RxStore = Store & {
  undo: () => void;
  redo: () => void;
  history: History;
  change$: Observable<Array<AnyAction>>;
};

export type RxStoreOptions = {
  getReadonly?: () => boolean;
  getHistory?: (options: HistoryOptions) => History;
};

export const HISTORY_LIMIT = 2048;

export function createRxStore(
  context: EngineContext,
  { getReadonly = () => false, getHistory }: RxStoreOptions = {}
): RxStore {
  const subscriptionSet = new Set<Subscription>();
  const store = createStore(context);
  const hooks = createHooks(store);
  const historyOptions: HistoryOptions = {
    notify: payload => store.dispatch(changeHasHistoryAction(payload)),
    dispatch: store.dispatchSync,
  };
  const history = getHistory?.(historyOptions) ?? createHistory(historyOptions);
  history.setLimit(HISTORY_LIMIT);

  const dispatch$ = new Subject<Array<AnyAction>>();
  const history$ = dispatch$.pipe(
    actionsFilter(HistoryActionTypes),
    ignoreTagFilter([Tag.changeOnly, Tag.shared]),
    readonlyIgnoreFilter(getReadonly),
    groupByStreamActions(StreamActionTypes, [
      ['@@move', StreamRegroupMoveActionTypes],
      ['@@scroll', StreamRegroupScrollActionTypes],
      ['@@color', StreamRegroupColorActionTypes],
    ])
  );
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(
    actionsFilter(ChangeActionTypes),
    readonlyIgnoreFilter(getReadonly, [Tag.shared]),
    debounceTime(200)
  );

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
    history.clear();
    dispatch$.complete();
  };

  const undo = () => {
    if (getReadonly()) return;
    history.undo();
  };

  const redo = () => {
    if (getReadonly()) return;
    history.redo();
  };

  subscriptionSet
    .add(history$.subscribe(pushHistory(store, history)))
    .add(
      dispatch$
        .pipe(readonlyIgnoreFilter(getReadonly, [Tag.shared]))
        .subscribe(store.dispatchSync)
    );

  return Object.freeze({
    ...store,
    dispatch,
    dispatchSync,
    destroy,
    undo,
    redo,
    history,
    change$,
  });
}
