import {
  AnyAction,
  CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isFunction, isNil } from 'es-toolkit';
import {
  debounceTime,
  filter,
  Observable,
  startWith,
  Subject,
  Subscription,
  switchMap,
} from 'rxjs';

import {
  ChangeActionTypes,
  EditStateOpenActionTypes,
  HistoryActionTypes,
  movesClock,
  opensEditDialog,
  StreamActionTypes,
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
} from '@/engine/actions';
import { slotOf } from '@/engine/clock';
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
import {
  changeHasHistoryAction,
  keepsDictionaries,
} from '@/engine/modules/editor/atom.actions';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  actionsFilter,
  groupByStreamActions,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import { lockIgnoreFilter } from '@/engine/rx-operators/lockIgnoreFilter';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import {
  alignViewport,
  readonlyScreenTag,
} from '@/engine/rx-operators/readonlyScreenTag';
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
  /**
   * Whether it was created with readonlyEditState, which a shared store over
   * it reads to send none of its changes while it is readonly.
   */
  readonlyEditState: boolean;
};

export type RxStoreOptions = {
  getReadonly?: () => boolean;
  /**
   * While readonly, also drops what opens an edit, sends a peer no change and
   * keeps each setting its reader turns on its own screen. Only the editor
   * element's store sets it; the viewer's and the diff panes' do not.
   */
  readonlyEditState?: boolean;
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

const isLoadOrClear = arrayHas<string>([
  EditorActionType.loadJson,
  EditorActionType.clear,
]);

/** An action that replaces the rows the sheets' entries were made on. */
const isDocumentReplace = ({ type, payload }: AnyAction) =>
  isLoadOrClear(type) && !keepsDictionaries(payload);

export function createRxStore(
  context: EngineContext,
  {
    getReadonly = () => false,
    readonlyEditState = false,
    getHistory,
    manualStreamFlush = false,
    observable = true,
  }: RxStoreOptions = {}
): RxStore {
  const subscriptionSet = new Set<Subscription | Unsubscribe>();
  const store = createStore(context, observable);
  // Before the first version is stamped, so every one this store writes holds
  // its editor's slot.
  context.clock.setSlot(slotOf(store.state.editor.id));
  const hooks = createHooks(store);
  // A replay passes no operator, so an undo of a pan once writable again is led
  // by the screen's placement here, or the replica takes it from the old one.
  const replay: HistoryOptions['dispatch'] = readonlyEditState
    ? actions => store.dispatchSync(alignViewport(actions, store.state))
    : store.dispatchSync;
  const historyOptions: HistoryOptions = {
    notify: payload => store.dispatch(changeHasHistoryAction(payload)),
    dispatch: replay,
    getNextVersion: () => context.clock.getNextVersion(),
    getState: () => store.state,
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
  /** A Dictionary tab batch to its sheet's history, every other to the document's. */
  const toHistory = (actions: Array<AnyAction>) => {
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
  const viewRedirected$ = dispatch$.pipe(viewActionRedirect(getView));
  // A setting a readonly reader turns stays its own screen (Tag.screen), which
  // the history, change$ and the outbound pipe drop and both filters pass.
  const redirected$ = readonlyEditState
    ? viewRedirected$.pipe(readonlyScreenTag(getReadonly, () => store.state))
    : viewRedirected$;
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
  // While readonly only a peer's edit passes, and the element sends no change
  // event for it then; a setting or the viewport a reader turns is its own
  // screen, no edit to save.
  const change$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(
    actionsFilter(ChangeActionTypes),
    ignoreTagFilter([Tag.screen]),
    lockIgnoreFilter(() => store.state.settings.lockSettings),
    readonlyIgnoreFilter(getReadonly, [Tag.shared], ChangeActionTypes),
    debounceTime(200)
  );

  // Only a batch holding a change or the handshake takes the next version, so
  // presence or a selection takes the version the clock holds. A pan a view
  // redirects takes the next too, but mergeClock passes the view's type over.
  const toActions = (
    ...compositionActions: CompositionActions
  ): AnyAction[] => {
    const actions = compositionActionsFlat(
      store.state,
      store.context,
      compositionActions
    );
    const version = actions.some(({ type }) => movesClock(type))
      ? context.clock.getNextVersion()
      : context.clock.getVersion();
    return actions.map(action => {
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

  // An editor built before the slot stamps its presence one past its own clock,
  // and a pan a view redirects was stamped as a change, so the versions of
  // what moves no clock are passed over.
  const mergeClock = () => {
    return store.subscribe(actions => {
      actions.forEach(({ type, version }) => {
        if (movesClock(type)) context.clock.merge(version);
      });
    });
  };

  // A load or a clear that lands with rows of its own, a peer's or a history
  // replay's included, replaces the rows the sheets' entries were made on, so
  // it empties them, or an undo would bring an old row back into the new ones.
  const clearSheetsOnReplace = () =>
    store.subscribe(actions => {
      if (actions.some(isDocumentReplace)) clearSheetHistories();
    });

  subscriptionSet
    .add(history$.subscribe(pushHistory(store, history)))
    .add(
      redirected$
        .pipe(
          actionsFilter(HistoryActionTypes),
          ignoreTagFilter([Tag.changeOnly, Tag.shared, Tag.screen]),
          // A readonly reader records no entry, its scrolls and zooms included,
          // so an undo once writable again takes back nothing made while reading.
          filter(() => !getReadonly()),
          viewIgnoreFilter(getView)
        )
        .subscribe(toHistory)
    )
    .add(
      redirected$
        .pipe(
          readonlyIgnoreFilter(
            getReadonly,
            [Tag.shared, Tag.screen],
            readonlyEditState ? EditStateOpenActionTypes : [],
            readonlyEditState ? opensEditDialog : undefined
          ),
          viewIgnoreFilter(getView, [Tag.shared, Tag.screen])
        )
        .subscribe(store.dispatchSync)
    )
    .add(mergeClock())
    .add(clearSheetsOnReplace());

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
    readonlyEditState,
  });
}
