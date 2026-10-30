import { toDocumentJson, toJson } from '@dineug/erd-editor-schema';
import {
  type AnyAction,
  type CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import {
  filter,
  map,
  merge,
  Observable,
  Subject,
  type Subscription,
} from 'rxjs';

import { createLegacyStreamActionsCompressor } from '@/__test-utils__/legacyCompressor';
import type { MeshPeer } from '@/__test-utils__/peerMesh';
import {
  ChangeActionTypes,
  SharedActionTypes,
  SharedFollowingActionTypes,
  StreamActionTypes,
} from '@/engine/actions';
import { Clock } from '@/engine/clock';
import { createEngineContext } from '@/engine/context';
import { createHistory, type History } from '@/engine/history';
import {
  changeViewportAction,
  focusTableEndAction,
  getLWWAction,
  initialLoadJsonAction,
  mergeLWWAction,
} from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import type { DispatchReport, RevertResult } from '@/engine/peer-store';
import {
  actionsFilter,
  bufferCircuitBreaker,
  ignoreTagFilter,
} from '@/engine/rx-operators';
import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import { createRxStore } from '@/engine/rx-store';
import { createStreamFlusher } from '@/engine/stream-flush';
import { attachActionsTag, attachActionTag, Tag } from '@/engine/tag';
import { defaultToWidth } from '@/engine/to-width';
import { arrayHas } from '@/utils/arrayHas';
import { toLoadValue } from '@/utils/loadValue';

/** The clock of an editor built before the slot: one past the highest version seen. */
export class LegacyClock extends Clock {
  override readonly getNextVersion = (): number => this.getVersion() + 1;

  override readonly setSlot = (): this => this;
}

// The outbound pipe's two compressor stages, as the shared store flushes them.
const FLUSH_TICKS = 2;

const hasChangeActionTypes = arrayHas<string>(ChangeActionTypes);
const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);
const hasFollowingActionTypes = arrayHas<string>(SharedFollowingActionTypes);
const hasCreateActionTypes = arrayHas<string>([
  'table.add',
  'column.add',
  'memo.add',
  'index.add',
  'indexColumn.add',
  'relationship.add',
  'tableGroup.add',
  'dictionary.add',
]);

/** The history as given, every push counted, which a dispatch reports as its entries. */
function countPushes(history: History, onPush: () => void): History {
  return Object.freeze({
    get cursor() {
      return history.cursor;
    },
    get size() {
      return history.size;
    },
    hasUndo: history.hasUndo,
    hasRedo: history.hasRedo,
    undo: history.undo,
    redo: history.redo,
    push: command => {
      onPush();
      history.push(command);
    },
    clear: history.clear,
    setLimit: history.setLimit,
    clone: history.clone,
  });
}

/**
 * A peer of an editor built before the slot: its clock stamps every batch one
 * past the highest version seen and takes every version, and its outbound pipe
 * sends it. The reducers are this tree's, so a spec asserts none of its geometry.
 */
export function createLegacyPeer({
  nickname,
  toWidth = defaultToWidth,
}: {
  nickname: string;
  toWidth?: (text: string) => number;
}): MeshPeer {
  const clock = new LegacyClock();
  let pushes = 0;
  const rxStore = createRxStore(
    { ...createEngineContext({ toWidth, routes: false }), clock },
    {
      manualStreamFlush: true,
      observable: false,
      getHistory: options =>
        countPushes(createHistory(options), () => pushes++),
    }
  );
  const editorId = rxStore.state.editor.id;
  const sharedMeta = { editorId, nickname };
  const subscribers = new Set<(actions: AnyAction[]) => void>();
  const internal$ = new Subject<Array<AnyAction>>();
  const opening$ = new Subject<void>();
  const closing$ = new Subject<void>();
  const flush$ = new Subject<void>();
  const compressor = createLegacyStreamActionsCompressor(
    flushOnNotifier(flush$)
  );
  const flusher = createStreamFlusher(rxStore, {
    flushStreamBuffers: () => {
      for (let tick = 0; tick < FLUSH_TICKS; tick++) flush$.next();
    },
  });
  const reduced$ = new Observable<Array<AnyAction>>(subscriber =>
    rxStore.subscribe(actions => subscriber.next(actions))
  );

  let subscribed = false;
  let batches = 0;

  /**
   * Every batch, a pointer's or a load's alike, stamps the next version on the
   * actions that carry none; a received action keeps the version its sender gave.
   */
  const dispatchSync = (compositionActions: CompositionActions) => {
    const actions = compositionActionsFlat(
      rxStore.state,
      rxStore.context,
      compositionActions
    );
    const version = clock.getNextVersion();
    actions.forEach(action => (action.version ??= version));
    rxStore.dispatchSync(actions);
    return actions;
  };

  const requestLWW = () => {
    internal$.next([{ ...getLWWAction(), version: clock.getVersion() }]);
  };

  const subscriptions: Array<Subscription | (() => void)> = [
    rxStore.subscribe(actions =>
      actions.forEach(action => clock.merge(action.version))
    ),
    merge(reduced$, internal$)
      .pipe(
        actionsFilter(SharedActionTypes),
        ignoreTagFilter([Tag.shared, Tag.screen]),
        compressor,
        bufferCircuitBreaker(opening$, closing$),
        compressor,
        map(actions =>
          attachActionsTag(
            Tag.shared,
            actions.map(action => {
              const sent = {
                ...action,
                meta: { ...action.meta, ...sharedMeta },
              };
              return hasFollowingActionTypes(action.type)
                ? attachActionTag(Tag.following, sent)
                : sent;
            })
          )
        )
      )
      .subscribe(actions => {
        if (actions.some(({ type }) => hasChangeActionTypes(type))) batches++;
        subscribers.forEach(fn => fn(actions));
      }),
    reduced$
      .pipe(
        filter(
          actions =>
            subscribed &&
            actions.some(({ type }) => type === initialLoadJsonAction.type)
        )
      )
      .subscribe(requestLWW),
  ];

  dispatchSync([changeViewportAction({ width: 0, height: 0 })]);

  const dispatch = (compositionActions: CompositionActions): DispatchReport => {
    const batchesBefore = batches;
    const pushesBefore = pushes;
    const actions = dispatchSync(compositionActions);

    if (actions.some(({ type }) => hasStreamActionTypes(type))) {
      flusher.flush();
    }

    return {
      label: null,
      actions: actions.filter(({ type }) => hasChangeActionTypes(type)),
      createdIds: actions
        .filter(({ type }) => hasCreateActionTypes(type))
        .map(({ payload }) => payload.id),
      batches: batches - batchesBefore,
      historyEntries: pushes - pushesBefore,
    };
  };

  const receive = (actions: AnyAction[] | AnyAction) => {
    const batch = [actions].flat();
    dispatchSync(batch);

    const { lww } = rxStore.state;
    if (batch.some(({ type }) => type === getLWWAction.type) && !isEmpty(lww)) {
      internal$.next([
        { ...mergeLWWAction({ lww }), version: clock.getVersion() },
      ]);
    }
  };

  /** One history entry back, as the editor's own undo takes it. */
  const undo = (): RevertResult => {
    const entries = rxStore.history.hasUndo() ? 1 : 0;
    rxStore.undo();
    flusher.flush();
    return { label: null, entries, skipped: [] };
  };

  const subscribe = (fn: (actions: AnyAction[]) => void) => {
    subscribers.add(fn);
    if (!subscribed) {
      subscribed = true;
      opening$.next();
      requestLWW();
    }

    return () => {
      subscribers.delete(fn);
    };
  };

  return Object.freeze({
    editorId,
    get value() {
      return toDocumentJson(rxStore.state);
    },
    get runtimeValue() {
      return toJson(rxStore.state);
    },
    get state() {
      return rxStore.state;
    },
    setInitialValue: (value: string) => {
      dispatchSync([
        focusTableEndAction(),
        initialLoadJsonAction$(toLoadValue(value)),
      ]);
      rxStore.resetHistory();
    },
    mergeClock: (version: number) => {
      clock.merge(version);
    },
    dispatch,
    receive,
    undo,
    subscribe,
    destroy: () => {
      subscriptions.forEach(sub =>
        typeof sub === 'function' ? sub() : sub.unsubscribe()
      );
      subscribers.clear();
      [internal$, opening$, closing$, flush$].forEach(subject =>
        subject.complete()
      );
      rxStore.destroy();
    },
  });
}
