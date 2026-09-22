import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isFunction, isNil } from 'es-toolkit';
import {
  debounceTime,
  Observable,
  startWith,
  Subject,
  Subscription,
  switchMap,
} from 'rxjs';

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
import { getActiveView } from '@/engine/modules/editor/view';
import {
  actionsFilter,
  groupByStreamActions,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import { viewActionRedirect } from '@/engine/rx-operators/viewActionRedirect';
import { viewIgnoreFilter } from '@/engine/rx-operators/viewIgnoreFilter';
import { createStore, Store } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { Tag } from '@/engine/tag';
import type { Unsubscribe } from '@/internal-types';

export type RxStore = Store & {
  undo: () => void;
  redo: () => void;
  history: History;
  resetHistory: () => void;
  change$: Observable<Array<AnyAction>>;
  /**
   * Closes the stream groups the history is still buffering, now. A no-op
   * unless the store was created with manualStreamFlush.
   */
  flushStreamBuffers: () => void;
};

export type RxStoreOptions = {
  getReadonly?: () => boolean;
  getHistory?: (options: HistoryOptions) => History;
  /** Closes stream buffers on flushStreamBuffers() instead of after 200 ms. */
  manualStreamFlush?: boolean;
};

export const HISTORY_LIMIT = 2048;

export function createRxStore(
  context: EngineContext,
  {
    getReadonly = () => false,
    getHistory,
    manualStreamFlush = false,
  }: RxStoreOptions = {}
): RxStore {
  const subscriptionSet = new Set<Subscription | Unsubscribe>();
  const store = createStore(context);
  const hooks = createHooks(store);
  const historyOptions: HistoryOptions = {
    notify: payload => store.dispatch(changeHasHistoryAction(payload)),
    dispatch: store.dispatchSync,
    getNextVersion: () => context.clock.getNextVersion(),
  };
  const history = getHistory?.(historyOptions) ?? createHistory(historyOptions);
  history.setLimit(HISTORY_LIMIT);

  const getView = () => getActiveView(store.state);

  const dispatch$ = new Subject<Array<AnyAction>>();
  // The one seam a view has: what is dispatched is read against the state as
  // it stands, so a batch that opens or closes a view is classified before it.
  const redirected$ = dispatch$.pipe(viewActionRedirect(getView));
  // An undo entry reads the state its batch has not reached yet, so the history
  // holds one subscription ahead of the reducer and a reset swaps only the
  // stream grouping behind it, which drops what that grouping still buffers.
  const historyInput$ = new Subject<Array<AnyAction>>();
  const historyReset$ = new Subject<void>();
  // One notifier for the store's whole life, so the chain a reset starts
  // listens to the same one.
  const flush$ = new Subject<void>();
  const history$ = historyReset$.pipe(
    startWith(undefined),
    switchMap(() =>
      historyInput$.pipe(
        groupByStreamActions(
          StreamActionTypes,
          [
            ['@@move', StreamRegroupMoveActionTypes],
            ['@@scroll', StreamRegroupScrollActionTypes],
            ['@@color', StreamRegroupColorActionTypes],
          ],
          manualStreamFlush ? flushOnNotifier(flush$) : undefined
        )
      )
    )
  );
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(
    actionsFilter(ChangeActionTypes),
    readonlyIgnoreFilter(getReadonly, [Tag.shared]),
    debounceTime(200)
  );

  const toActions = (
    ...compositionActions: CompositionActions
  ): AnyAction[] => {
    const version = context.clock.getNextVersion();
    return compositionActionsFlat(
      store.state,
      store.context,
      compositionActions
    ).map(action => {
      if (isNil(action.version)) {
        action.version = version;
      }
      return action;
    });
  };

  const dispatchSync = (...compositionActions: CompositionActions) => {
    const actions = toActions(compositionActions);
    dispatch$.next(actions);
  };

  const dispatch = (...compositionActions: CompositionActions) => {
    queueMicrotask(() => dispatchSync(compositionActions));
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub =>
      isFunction(sub) ? sub() : sub.unsubscribe()
    );
    subscriptionSet.clear();
    store.destroy();
    hooks.destroy();
    history.clear();
    dispatch$.complete();
    flush$.complete();
  };

  /** Empties both stacks, dropping a stream burst still being grouped as well. */
  const resetHistory = () => {
    historyReset$.next();
    history.clear();
  };

  // A replay reaches the store through historyOptions.dispatch, past the seam
  // above, so an active view is refused here or the document moves under it.
  const undo = () => {
    if (getReadonly() || getView()) return;
    history.undo();
  };

  const redo = () => {
    if (getReadonly() || getView()) return;
    history.redo();
  };

  // The history groups stream actions in one stage, so a single tick closes it.
  const flushStreamBuffers = () => {
    if (manualStreamFlush) flush$.next();
  };

  const mergeClock = () => {
    return store.subscribe(actions => {
      actions.forEach(action => context.clock.merge(action.version));
    });
  };

  subscriptionSet
    .add(history$.subscribe(pushHistory(store, history)))
    .add(
      redirected$
        .pipe(
          actionsFilter(HistoryActionTypes),
          ignoreTagFilter([Tag.changeOnly, Tag.shared]),
          readonlyIgnoreFilter(getReadonly),
          viewIgnoreFilter(getView)
        )
        .subscribe(historyInput$)
    )
    .add(
      redirected$
        .pipe(
          readonlyIgnoreFilter(getReadonly, [Tag.shared]),
          viewIgnoreFilter(getView, [Tag.shared])
        )
        .subscribe(store.dispatchSync)
    )
    .add(mergeClock());

  return Object.freeze({
    ...store,
    dispatch,
    dispatchSync,
    destroy,
    undo,
    redo,
    history,
    resetHistory,
    change$,
    flushStreamBuffers,
  });
}
