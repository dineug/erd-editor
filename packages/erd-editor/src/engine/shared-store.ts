import { AnyAction } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import { map, merge, Observable, Subject, Subscription } from 'rxjs';

import {
  SharedActionTypes,
  SharedFollowingActionTypes,
} from '@/engine/actions';
import {
  getLWWAction,
  mergeLWWAction,
} from '@/engine/modules/editor/atom.actions';
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
import { RxStore } from '@/engine/rx-store';
import { attachActionsTag, attachActionTag, Tag } from '@/engine/tag';
import { Unsubscribe } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';

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
    manualStreamFlush ? flushOnNotifier(flush$) : quietPeriodOrNotifier(flush$)
  );

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
        ignoreTagFilter([Tag.shared]),
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

  const halfOpenNotify = () => {
    const isSubscribe = 0 < observerSubscriptionSet.size;
    if (isConnection && isSubscribe) {
      openingNotifier$.next();
    } else {
      closingNotifier$.next();
    }
  };

  const toMergeLWWAction = (actions: Array<AnyAction> | AnyAction) => {
    const safeActions = Array.isArray(actions) ? actions : [actions];
    const isGetLWWAction = safeActions.some(
      action => action.type === getLWWAction.type
    );
    const lww = store.state.lww;

    if (isGetLWWAction && !isEmpty(lww)) {
      internal$.next([
        {
          ...mergeLWWAction({ lww }),
          version: store.context.clock.getVersion(),
        },
      ]);
    }
  };

  const subscribe = (fn: (value: AnyAction[]) => void) => {
    const subscription = observer$.subscribe(actions => fn(actions));
    observerSubscriptionSet.add(subscription);
    halfOpenNotify();

    if (firstSubscribe) {
      internal$.next([
        {
          ...getLWWAction(),
          version: store.context.clock.getVersion(),
        },
      ]);
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

  const flushStreamBuffers = () => {
    for (let tick = 0; tick < FLUSH_TICKS; tick++) {
      flush$.next();
    }
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
    destroy,
  });
}
