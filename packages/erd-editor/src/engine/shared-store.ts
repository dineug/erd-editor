import { AnyAction } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { last, pick } from 'lodash-es';
import { map, Observable, Subscription, throttleTime } from 'rxjs';

import {
  SharedActionTypes,
  SharedStreamActionTypes,
  StreamActionTypes,
  StreamRegroupColorActionTypes,
  StreamRegroupMoveActionTypes,
  StreamRegroupScrollActionTypes,
} from '@/engine/actions';
import { pushStreamHistoryMap } from '@/engine/history.actions';
import {
  actionsFilter,
  groupByStreamActions,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { RxStore } from '@/engine/rx-store';
import { attachActionTag, Tag } from '@/engine/tag';
import { Unsubscribe } from '@/internal-types';

type CompositionSharedAction = AnyAction | Array<CompositionSharedAction>;
type CompositionSharedActions = Array<CompositionSharedAction>;

export type SharedStore = {
  dispatch: (...actions: CompositionSharedActions) => void;
  dispatchSync: (...actions: CompositionSharedActions) => void;
  subscribe: (fn: (value: AnyAction[]) => void) => Unsubscribe;
  destroy: () => void;
};

export type SharedStoreConfig = {
  nickname?: string;
};

const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);
const hasSharedStreamActionTypes = arrayHas<string>(SharedStreamActionTypes);

export function createSharedStore(
  store: RxStore,
  config?: SharedStoreConfig
): SharedStore {
  const editorId = store.state.editor.id;
  const sharedMeta = { ...pick(config, 'nickname'), editorId };
  const subscriptionSet = new Set<Subscription>();
  const subscribe$ = new Observable<Array<AnyAction>>(subscriber =>
    store.subscribe(actions => subscriber.next(actions))
  ).pipe(
    actionsFilter(SharedActionTypes),
    ignoreTagFilter([Tag.shared]),
    groupByStreamActions(SharedStreamActionTypes, [], throttleTime(100)),
    map(actions =>
      hasSharedStreamActionTypes(actions[0]?.type)
        ? [last(actions) as AnyAction]
        : actions
    ),
    groupByStreamActions(StreamActionTypes, [
      ['@@move', StreamRegroupMoveActionTypes],
      ['@@scroll', StreamRegroupScrollActionTypes],
      ['@@color', StreamRegroupColorActionTypes],
    ]),
    map(actions => {
      if (!hasStreamActionTypes(actions[0]?.type)) {
        return actions;
      }

      const redoActions: AnyAction[] = [];
      for (const key of Object.keys(pushStreamHistoryMap)) {
        pushStreamHistoryMap[key]([], redoActions, actions);
      }

      return redoActions.length ? redoActions : actions;
    }),
    map(actions =>
      attachActionTag(
        Tag.shared,
        actions.map(action => ({
          ...action,
          meta: Object.assign({}, action.meta ?? {}, sharedMeta),
        }))
      )
    )
  );

  const dispatchSync = (...actions: CompositionSharedActions) => {
    store.dispatchSync(actions);
  };

  const dispatch = (...actions: CompositionSharedActions) => {
    store.dispatch(actions);
  };

  const subscribe = (fn: (value: AnyAction[]) => void) => {
    const subscription = subscribe$.subscribe(actions => fn(actions));
    subscriptionSet.add(subscription);

    return () => {
      subscription.unsubscribe();
      subscriptionSet.delete(subscription);
    };
  };

  const destroy = () => {
    Array.from(subscriptionSet).forEach(sub => sub.unsubscribe());
    subscriptionSet.clear();
  };

  return Object.freeze({
    dispatch,
    dispatchSync,
    subscribe,
    destroy,
  });
}
