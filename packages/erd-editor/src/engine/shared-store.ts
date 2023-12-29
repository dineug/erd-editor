import { AnyAction } from '@dineug/r-html';
import { pick } from 'lodash-es';
import { map, Observable, Subject, Subscription } from 'rxjs';

import { SharedActionTypes } from '@/engine/actions';
import {
  actionsFilter,
  bufferCircuitBreaker,
  ignoreTagFilter,
  sharedStreamActionsCompressor,
} from '@/engine/rx-operators';
import { RxStore } from '@/engine/rx-store';
import { attachActionTag, Tag } from '@/engine/tag';
import { Unsubscribe } from '@/internal-types';

type CompositionSharedAction = AnyAction | Array<CompositionSharedAction>;
type CompositionSharedActions = Array<CompositionSharedAction>;

export type SharedStore = {
  connection: () => void;
  disconnect: () => void;
  dispatch: (...actions: CompositionSharedActions) => void;
  dispatchSync: (...actions: CompositionSharedActions) => void;
  subscribe: (fn: (value: AnyAction[]) => void) => Unsubscribe;
  destroy: () => void;
};

export type SharedStoreConfig = {
  nickname?: string;
};

export function createSharedStore(
  store: RxStore,
  config?: SharedStoreConfig
): SharedStore {
  const editorId = store.state.editor.id;
  const sharedMeta = { ...pick(config, 'nickname'), editorId };
  const subscriptionSet = new Set<Subscription>();
  const observerSubscriptionSet = new Set<Subscription>();
  const observer$ = new Subject<Array<AnyAction>>();
  const openingNotifier$ = new Subject<void>();
  const closingNotifier$ = new Subject<void>();

  let isConnection = true;

  subscriptionSet.add(
    new Observable<Array<AnyAction>>(subscriber =>
      store.subscribe(actions => subscriber.next(actions))
    )
      .pipe(
        actionsFilter(SharedActionTypes),
        ignoreTagFilter([Tag.shared]),
        sharedStreamActionsCompressor,
        bufferCircuitBreaker(openingNotifier$, closingNotifier$),
        sharedStreamActionsCompressor,
        map(actions =>
          attachActionTag(
            Tag.shared,
            actions.map(action => ({
              ...action,
              meta: Object.assign({}, action.meta ?? {}, sharedMeta),
            }))
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

  const subscribe = (fn: (value: AnyAction[]) => void) => {
    const subscription = observer$.subscribe(actions => fn(actions));
    observerSubscriptionSet.add(subscription);
    halfOpenNotify();

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

  const dispatchSync = (...actions: CompositionSharedActions) => {
    store.dispatchSync(actions);
  };

  const dispatch = (...actions: CompositionSharedActions) => {
    store.dispatch(actions);
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    Array.from(observerSubscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
    observerSubscriptionSet.clear();
  };

  return Object.freeze({
    connection,
    disconnect,
    dispatch,
    dispatchSync,
    subscribe,
    destroy,
  });
}
