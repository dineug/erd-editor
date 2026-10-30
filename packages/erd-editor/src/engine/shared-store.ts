import { isSettingLocked, type LWW } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { pick } from 'es-toolkit';
import { isEmpty } from 'es-toolkit/compat';
import { filter, map, merge, Observable, Subject, Subscription } from 'rxjs';

import { CanvasType, LockSettingType } from '@/constants/schema';
import {
  ChangeActionTypes,
  SharedActionTypes,
  SharedFollowingActionTypes,
} from '@/engine/actions';
import {
  getLWWAction,
  initialLoadJsonAction,
  mergeLWWAction,
} from '@/engine/modules/editor/atom.actions';
import {
  initialLoadJsonAction$,
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import {
  changeCanvasTypeAction,
  changeNameViewModeAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { screenSettingRestores } from '@/engine/modules/settings/generator.actions';
import type { ScreenSettingUnit } from '@/engine/modules/settings/screenBaseline';
import { clearSharedTrackers } from '@/engine/presence';
import {
  actionsFilter,
  bufferCircuitBreaker,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { createSharedStreamActionsCompressor } from '@/engine/rx-operators/createSharedStreamActionsCompressor';
import {
  flushOnNotifier,
  quietPeriodOrNotifier,
} from '@/engine/rx-operators/flushOnNotifier';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import { attachActionsTag, attachActionTag, Tag } from '@/engine/tag';
import { Unsubscribe } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { toLoadValue } from '@/utils/loadValue';

declare const registersBrand: unique symbol;

/**
 * A store's registers as JSON, handed to another store's mergeLWW or reseed as
 * they are. Their shape is the engine's own, so no caller reads a field of them.
 */
export type SharedRegisters = Record<string, unknown> & {
  readonly [registersBrand]: true;
};

export type ReseedOptions = {
  /** The registers held beside the value, as the store that wrote it gave them. */
  lww: SharedRegisters;
  /** The highest version merged beside the value, which the clock takes. */
  version: number;
  /**
   * Keeps the reader's screen on its screen alone, as a peer's load does: the
   * tab, the origin and the zoom once a measure showed them, a locked name view
   * and what a readonly reader turned. value and runtimeValue keep the loaded.
   */
  keepScreen?: boolean;
};

export type SharedStore = {
  connection: () => void;
  disconnect: () => void;
  dispatch: (actions: Array<AnyAction> | AnyAction) => void;
  dispatchSync: (actions: Array<AnyAction> | AnyAction) => void;
  subscribe: (fn: (value: AnyAction[]) => void) => Unsubscribe;
  /**
   * Sends the stream groups still held back from the peers, now, rather than
   * after their quiet period: what a host calls before it lets a store go.
   */
  flushStreamBuffers: () => void;
  /** A copy of the registers the store holds, as JSON. */
  getLWW: () => SharedRegisters;
  /**
   * Takes registers another store gave into this one's, and the version beside
   * them into its clock, sending nothing and answering nothing.
   */
  mergeLWW: (lww: SharedRegisters, version: number) => void;
  /** The highest version the store's clock has merged. */
  getVersion: () => number;
  /** Drops the cursor, focus, selection and marquee one other editor sent, with their expiry. */
  forgetPeer: (editorId: string) => void;
  /**
   * Opens a document again as a rejoin does: no undo entry, selection or focus
   * left, no change event or change sent, the reader's screen kept when asked.
   * Streams still held go out after it, so a host flushes them into the value first.
   */
  reseed: (value: string, options: ReseedOptions) => void;
  destroy: () => void;
};

export type SharedStoreConfig = {
  getNickname?: () => string;
};

/** Not part of getSharedStore's config: only a headless peer sets this. */
export type SharedStoreInternalOptions = {
  /** Closes stream buffers on flushStreamBuffers() instead of after 200 ms. */
  manualStreamFlush?: boolean;
};

// A compressor stands on each side of the circuit breaker. A Subject emits to a
// copy of its observers, so a group the first one closes arms in the second too
// late for that tick and waits for the next.
const FLUSH_TICKS = 2;

const hasSharedFollowingActionTypes = arrayHas<string>(
  SharedFollowingActionTypes
);

type ReaderScreen = ReturnType<typeof readScreen>;

/**
 * The reader's screen as a rejoin keeping it reads it before the load: the
 * origin and the zoom once a measure showed them, the tab, the name view, and
 * each other setting a readonly reader's turn holds over the document's.
 */
function readScreen({ settings, editor }: RootState) {
  const held = Object.keys(editor.screenBaseline ?? {}).filter(
    (unit): unit is ScreenSettingUnit => unit !== 'viewport'
  );
  return {
    viewport: editor.originShown
      ? pick(settings, ['originX', 'originY', 'zoomLevel'])
      : null,
    canvasType: settings.canvasType,
    lastCanvasType: editor.lastCanvasType,
    nameViewMode: settings.nameViewMode,
    held: pick(settings, held),
  };
}

/**
 * The turns that lay that screen back over the value loaded, as a peer's load
 * keeps it. An origin no measure showed opens where the load's pull puts it, as
 * a late joiner's does, and a name view no lock holds after the load is shared.
 */
function screenTurnsOf(
  screen: ReaderScreen,
  { settings, editor }: RootState
): AnyAction[] {
  const turns: AnyAction[] = [];
  if (screen.viewport) {
    const { originX, originY, zoomLevel } = screen.viewport;
    turns.push(
      scrollToAction({ originX, originY }),
      changeZoomLevelAction({ value: zoomLevel })
    );
  }
  // The tab goes back only where the load moved it, so a later load still moves
  // one the value opens on. On Settings the tab it came from goes first, which
  // a tab lock taken there names.
  if (screen.canvasType !== settings.canvasType) {
    if (screen.canvasType === CanvasType.settings) {
      turns.push(changeCanvasTypeAction({ value: screen.lastCanvasType }));
    }
    turns.push(changeCanvasTypeAction({ value: screen.canvasType }));
  }
  if (
    isSettingLocked(
      settings.lockSettings,
      LockSettingType.unlockNameViewMode
    ) &&
    screen.nameViewMode !== settings.nameViewMode
  ) {
    turns.push(
      changeNameViewModeAction({
        value: screen.nameViewMode,
        shared: false,
        editorId: editor.id,
      })
    );
  }
  turns.push(...screenSettingRestores(screen.held, settings));
  return turns;
}

export function createSharedStore(
  store: RxStore,
  config?: SharedStoreConfig,
  internal?: SharedStoreInternalOptions
): SharedStore {
  const manualStreamFlush = internal?.manualStreamFlush ?? false;
  const editorId = store.state.editor.id;
  const sharedMeta = { editorId };
  const subscriptionSet = new Set<Subscription>();
  const observerSubscriptionSet = new Set<Subscription>();
  const observer$ = new Subject<Array<AnyAction>>();
  const internal$ = new Subject<Array<AnyAction>>();
  const openingNotifier$ = new Subject<void>();
  const closingNotifier$ = new Subject<void>();
  const flush$ = new Subject<void>();
  const compressor = createSharedStreamActionsCompressor(
    manualStreamFlush ? flushOnNotifier(flush$) : quietPeriodOrNotifier(flush$),
    () => store.state
  );
  const getReadonly = store.readonlyEditState ? store.getReadonly : () => false;

  let isConnection = true;
  let firstSubscribe = true;

  subscriptionSet.add(
    merge(
      new Observable<Array<AnyAction>>(subscriber =>
        store.subscribe(actions => subscriber.next(actions))
      ),
      internal$
    )
      .pipe(
        actionsFilter(SharedActionTypes),
        ignoreTagFilter([Tag.shared, Tag.screen]),
        // A readonly editor sends no change, while presence and the registers
        // pass. Ahead of the compressors, so a drag they hold from before the
        // switch still leaves.
        readonlyIgnoreFilter(getReadonly, [], ChangeActionTypes),
        compressor,
        bufferCircuitBreaker(openingNotifier$, closingNotifier$),
        compressor,
        map(actions =>
          attachActionsTag(
            Tag.shared,
            actions.map(action => {
              const newAction = {
                ...action,
                meta: Object.assign({}, action.meta ?? {}, {
                  ...sharedMeta,
                  nickname: config?.getNickname?.(),
                }),
              };

              return hasSharedFollowingActionTypes(action.type)
                ? attachActionTag(Tag.following, newAction)
                : newAction;
            })
          )
        )
      )
      .subscribe(actions => observer$.next(actions))
  );

  const requestLWW = () => {
    internal$.next([
      {
        ...getLWWAction(),
        version: store.context.clock.getVersion(),
      },
    ]);
  };

  // A load that opens a document drops the registers, so once this store has
  // asked its peers for theirs it asks again, and they answer as to a joiner.
  subscriptionSet.add(
    new Observable<Array<AnyAction>>(subscriber =>
      store.subscribe(actions => subscriber.next(actions))
    )
      .pipe(
        filter(
          actions =>
            !firstSubscribe &&
            actions.some(({ type }) => type === initialLoadJsonAction.type)
        )
      )
      .subscribe(requestLWW)
  );

  const halfOpenNotify = () => {
    const isSubscribe = 0 < observerSubscriptionSet.size;
    if (isConnection && isSubscribe) {
      openingNotifier$.next();
    } else {
      closingNotifier$.next();
    }
  };

  const flushStreamBuffers = () => {
    for (let tick = 0; tick < FLUSH_TICKS; tick++) {
      flush$.next();
    }
  };

  /**
   * Answers a join with the registers, after the drag held here has left: the
   * answer carries its steps' versions, which a store that never sent the drag
   * would leave on every peer with no point behind them.
   */
  const toMergeLWWAction = (actions: Array<AnyAction> | AnyAction) => {
    const safeActions = Array.isArray(actions) ? actions : [actions];
    const isGetLWWAction = safeActions.some(
      action => action.type === getLWWAction.type
    );
    const lww = store.state.lww;

    if (isGetLWWAction && !isEmpty(lww)) {
      flushStreamBuffers();
      internal$.next([
        {
          ...mergeLWWAction({ lww }),
          version: store.context.clock.getVersion(),
        },
      ]);
    }
  };

  const getLWW = (): SharedRegisters =>
    JSON.parse(JSON.stringify(store.state.lww));

  // Tagged as a peer's, so the outbound pipe sends it on to nobody.
  const mergeLWW = (lww: SharedRegisters, version: number) => {
    store.dispatchSync({
      ...mergeLWWAction({ lww: lww as unknown as LWW }),
      version,
      tags: Tag.shared,
    });
    store.context.clock.merge(version);
  };

  const forgetPeer = (peerEditorId: string) => {
    clearSharedTrackers(store.state.editor, peerEditorId);
  };

  /**
   * Loads the value as it is, then lays the screen read before the load back
   * over it in a dispatch of its own: the load closes a view, and the seams
   * classify a batch by the state it enters with.
   */
  const reseed = (
    value: string,
    { lww, version, keepScreen = false }: ReseedOptions
  ) => {
    const screen = keepScreen ? readScreen(store.state) : null;

    // The selection and the focus may name what the value no longer holds, so
    // a rejoin drops them with the undo history.
    store.dispatchSync(
      unselectAllAction$(),
      initialLoadJsonAction$(toLoadValue(value))
    );
    mergeLWW(lww, version);
    store.resetHistory();
    if (!screen) return;

    const turns = screenTurnsOf(screen, store.state);
    if (turns.length === 0) return;

    // A screen turn writes no register, so it takes the version the clock holds.
    const screenVersion = store.context.clock.getVersion();
    store.dispatchSync(
      turns.map(action => ({
        ...action,
        version: screenVersion,
        tags: Tag.screen,
      }))
    );
  };

  const subscribe = (fn: (value: AnyAction[]) => void) => {
    const subscription = observer$.subscribe(actions => fn(actions));
    observerSubscriptionSet.add(subscription);
    halfOpenNotify();

    if (firstSubscribe) {
      requestLWW();
      firstSubscribe = false;
    }

    return () => {
      subscription.unsubscribe();
      observerSubscriptionSet.delete(subscription);
      halfOpenNotify();
    };
  };

  const connection = () => {
    isConnection = true;
    halfOpenNotify();
  };

  const disconnect = () => {
    isConnection = false;
    halfOpenNotify();
  };

  const dispatchSync = (actions: Array<AnyAction> | AnyAction) => {
    store.dispatchSync(actions);
    toMergeLWWAction(actions);
  };

  const dispatch = (actions: Array<AnyAction> | AnyAction) => {
    store.dispatch(actions);
    toMergeLWWAction(actions);
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    Array.from(observerSubscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
    observerSubscriptionSet.clear();
    observer$.complete();
    openingNotifier$.complete();
    closingNotifier$.complete();
    flush$.complete();
  };

  return Object.freeze({
    connection,
    disconnect,
    dispatch,
    dispatchSync,
    subscribe,
    flushStreamBuffers,
    getLWW,
    mergeLWW,
    getVersion: () => store.context.clock.getVersion(),
    forgetPeer,
    reseed,
    destroy,
  });
}
