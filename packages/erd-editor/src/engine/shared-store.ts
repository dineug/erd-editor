import { AnyAction } from '@dineug/r-html';
import { arrayHas, isArray } from '@dineug/shared';
import { isEmpty } from 'lodash-es';
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
  sharedStreamActionsCompressor,
} from '@/engine/rx-operators';
import { RxStore } from '@/engine/rx-store';
import { attachActionsTag, attachActionTag, Tag } from '@/engine/tag';
import { Unsubscribe } from '@/internal-types';

export type SharedStore = {
  connection: () => void;
  disconnect: () => void;
  dispatch: (actions: Array<AnyAction> | AnyAction) => void;
  dispatchSync: (actions: Array<AnyAction> | AnyAction) => void;
  subscribe: (fn: (value: AnyAction[]) => void) => Unsubscribe;
  destroy: () => void;
};

export type SharedStoreConfig = {
  getNickname?: () => string;
};

const hasSharedFollowingActionTypes = arrayHas<string>(
  SharedFollowingActionTypes
);

export function createSharedStore(
  store: RxStore,
  config?: SharedStoreConfig
): SharedStore {
  const editorId = store.state.editor.id;
  const sharedMeta = { editorId };
  const subscriptionSet = new Set<Subscription>();
  const observerSubscriptionSet = new Set<Subscription>();
  const observer$ = new Subject<Array<AnyAction>>();
  const internal$ = new Subject<Array<AnyAction>>();
  const openingNotifier$ = new Subject<void>();
  const closingNotifier$ = new Subject<void>();

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
        sharedStreamActionsCompressor,
        bufferCircuitBreaker(openingNotifier$, closingNotifier$),
        sharedStreamActionsCompressor,
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
    const safeActions = isArray(actions) ? actions : [actions];
    const isGetLWWAction = safeActions.some(
      action => action.type === getLWWAction.type
    );
    const lww = store.state.lww;

    if (isGetLWWAction && !isEmpty(lww)) {
      internal$.next([
        {
          ...mergeLWWAction({ lww }),
          version: store.context.clock.getNextVersion(),
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
          version: store.context.clock.getNextVersion(),
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

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    Array.from(observerSubscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
    observerSubscriptionSet.clear();
    store.destroy();
    observer$.complete();
    openingNotifier$.complete();
    closingNotifier$.complete();
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
