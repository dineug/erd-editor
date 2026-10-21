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
import {
  isDictionaryAction,
  pushHistory,
  pushSheetHistory,
} from '@/engine/history.actions';
import {
  DictionaryKind,
  DictionaryKindList,
} from '@/engine/modules/dictionary/actions';
import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { changeHasHistoryAction } from '@/engine/modules/editor/atom.actions';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  actionsFilter,
  groupByStreamActions,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import { lockIgnoreFilter } from '@/engine/rx-operators/lockIgnoreFilter';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import { viewActionRedirect } from '@/engine/rx-operators/viewActionRedirect';
import { viewIgnoreFilter } from '@/engine/rx-operators/viewIgnoreFilter';
import { createStore, Store } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { hasActionTag, Tag } from '@/engine/tag';
import type { Unsubscribe } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';

export type RxStore = Store & {
  undo: () => void;
  redo: () => void;
  history: History;
  /** The history of each dictionary sheet, which holds the Dictionary tab's edits of it. */
  sheetHistories: Readonly<Record<DictionaryKind, History>>;
  /** Undoes the last edit the Dictionary tab made on a sheet, as undo does the document's. */
  undoSheet: (sheet: DictionaryKind) => void;
  redoSheet: (sheet: DictionaryKind) => void;
  resetHistory: () => void;
  change$: Observable<Array<AnyAction>>;
  /**
   * Closes the stream groups the history is still buffering, now. A no-op
   * unless the store was created with manualStreamFlush.
   */
  flushStreamBuffers: () => void;
  /** Whether the editor is readonly now, which drops every edit of the document. */
  getReadonly: () => boolean;
};

export type RxStoreOptions = {
  getReadonly?: () => boolean;
  getHistory?: (options: HistoryOptions) => History;
  /** Closes stream buffers on flushStreamBuffers() instead of after 200 ms. */
  manualStreamFlush?: boolean;
  /**
   * Keeps the state a plain object when false. Nothing renders from a
   * headless store, and the reactive proxy reads DOM globals Node lacks.
   */
  observable?: boolean;
};

export const HISTORY_LIMIT = 2048;

/** A local batch that replaces the document the sheets' entries were made on. */
const isDocumentReplace = arrayHas<string>([
  EditorActionType.loadJson,
  EditorActionType.clear,
]);

export function createRxStore(
  context: EngineContext,
  {
    getReadonly = () => false,
    getHistory,
    manualStreamFlush = false,
    observable = true,
  }: RxStoreOptions = {}
): RxStore {
  const subscriptionSet = new Set<Subscription | Unsubscribe>();
  const store = createStore(context, observable);
  const hooks = createHooks(store);
  const historyOptions: HistoryOptions = {
    notify: payload => store.dispatch(changeHasHistoryAction(payload)),
    dispatch: store.dispatchSync,
    getNextVersion: () => context.clock.getNextVersion(),
  };
  const history = getHistory?.(historyOptions) ?? createHistory(historyOptions);
  history.setLimit(HISTORY_LIMIT);

  // Each dictionary sheet keeps the Dictionary tab's edits of it apart from the
  // document's, so an undo on the tab or on the canvas reaches only its own.
  const sheetHistories = Object.fromEntries(
    DictionaryKindList.map(sheet => {
      const sheetHistory = createHistory({
        ...historyOptions,
        notify: payload =>
          store.dispatch(changeHasHistoryAction({ ...payload, sheet })),
      });
      sheetHistory.setLimit(HISTORY_LIMIT);
      return [sheet, sheetHistory];
    })
  ) as Record<DictionaryKind, History>;
  const clearSheetHistories = () =>
    DictionaryKindList.forEach(sheet => sheetHistories[sheet].clear());
  const sheetHistoryOf = (actions: ReadonlyArray<AnyAction>) => {
    const row = actions.find(isDictionaryAction);
    return row ? sheetHistories[row.payload?.kind as DictionaryKind] : null;
  };
  /**
   * A Dictionary tab batch to its sheet's history, every other to the
   * document's. A load or a clear replaces the document the sheets' entries
   * were made on, so it empties them, or an undo would bring an old row back.
   */
  const toHistory = (actions: Array<AnyAction>) => {
    if (actions.some(({ type }) => isDocumentReplace(type))) {
      clearSheetHistories();
    }

    const sheetHistory = hasActionTag(actions, Tag.dictionarySheet)
      ? sheetHistoryOf(actions)
      : null;
    if (sheetHistory) pushSheetHistory(store, sheetHistory)(actions);
    else historyInput$.next(actions);
  };

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
            // What a drag's drop sends is tagged as the drag, so it closes
            // with the drag's moves into one undo entry rather than its own.
            ['@@move', StreamRegroupMoveActionTypes, Tag.drag],
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
    lockIgnoreFilter(() => store.state.settings.lockSettings),
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
    clearSheetHistories();
    dispatch$.complete();
    flush$.complete();
  };

  /** Empties both stacks, dropping a stream burst still being grouped as well. */
  const resetHistory = () => {
    historyReset$.next();
    history.clear();
    clearSheetHistories();
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

  const undoSheet = (sheet: DictionaryKind) => {
    if (getReadonly() || getView()) return;
    sheetHistories[sheet]?.undo();
  };

  const redoSheet = (sheet: DictionaryKind) => {
    if (getReadonly() || getView()) return;
    sheetHistories[sheet]?.redo();
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
        .subscribe(toHistory)
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
    sheetHistories,
    undoSheet,
    redoSheet,
    resetHistory,
    change$,
    flushStreamBuffers,
    getReadonly,
  });
}
