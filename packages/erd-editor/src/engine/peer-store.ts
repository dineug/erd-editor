import { toJson } from '@dineug/erd-editor-schema';
import {
  type AnyAction,
  type CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';

import { ChangeActionTypes, StreamActionTypes } from '@/engine/actions';
import { createEngineContext } from '@/engine/context';
import { createHistory, type History } from '@/engine/history';
import {
  changeViewportAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
  getLWWAction,
} from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import type { FocusType } from '@/engine/modules/editor/state';
import {
  clearSharedTrackers,
  createFocusPresence,
  type FocusPresence,
} from '@/engine/presence';
import { createRxStore } from '@/engine/rx-store';
import { createSharedStore } from '@/engine/shared-store';
import type { RootState } from '@/engine/state';
import { createStreamFlusher } from '@/engine/stream-flush';
import { defaultToWidth } from '@/engine/to-width';
import type { Unsubscribe, ValuesType } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { safeCallback } from '@/utils/safeCallback';
import { toSafeString } from '@/utils/validation';

export type PeerStoreOptions = {
  nickname: string;
  toWidth?: (text: string) => number;
  /** Sends the focused cell to the other peers. A headless session turns it off. */
  presence?: boolean;
  /** Refuses every dispatch, undo and redo, as a readonly document does. */
  readonly?: boolean;
};

/** The cell to focus before an edit, so the others see where the peer works. */
export type DispatchFocus = {
  tableId: string;
  columnId?: string;
  focusType: FocusType;
};

export type DispatchOptions = {
  /** Names the dispatch as one undo unit, echoed back by undo and redo. */
  label?: string;
  focus?: DispatchFocus;
};

export type DispatchReport = {
  label: string | null;
  /** The document changes the dispatch made, version stamped, in order. */
  actions: AnyAction[];
  createdIds: string[];
  /** Outbound batches that carried a document change. */
  batches: number;
  /** Undo entries the history took in. */
  historyEntries: number;
};

/**
 * What an undo or redo reverted: the dispatch's label, how many history
 * entries it took, and the labels passed over because the engine made them
 * no undo entry. Zero entries means there was nothing left to revert.
 */
export type RevertResult = {
  label: string | null;
  entries: number;
  skipped: string[];
};

/** Why a peer store refused a call before dispatching anything. */
export const PeerStoreErrorCode = {
  readonly: 'readonly',
  destroyed: 'destroyed',
} as const;
export type PeerStoreErrorCode = ValuesType<typeof PeerStoreErrorCode>;

const REFUSALS: Record<PeerStoreErrorCode, string> = {
  readonly: 'the document is readonly, so no edit was made',
  destroyed: 'this document session was closed; open the document again',
};

/** A refusal: the code says why, operation names the call, and nothing moved. */
export class PeerStoreError extends Error {
  readonly code: PeerStoreErrorCode;
  readonly operation: string;

  constructor(code: PeerStoreErrorCode, operation: string) {
    super(REFUSALS[code]);
    this.name = 'PeerStoreError';
    this.code = code;
    this.operation = operation;
  }
}

export type PeerStore = {
  readonly editorId: string;
  /** The document as the element would save it. */
  readonly value: string;
  /** The live state, for readers that serialize it another way. */
  readonly state: RootState;
  readonly isReadonly: boolean;
  readonly isDestroyed: boolean;
  setReadonly: (readonly: boolean) => void;
  /**
   * Replaces the document and forgets every undo entry and label with it,
   * since those were taken against the old one. The one reseed operation.
   */
  setInitialValue: (value: string) => void;
  mergeClock: (version: number) => void;
  dispatch: (
    actions: CompositionActions,
    options?: DispatchOptions
  ) => DispatchReport;
  /** Applies another peer's batch now, so a read right after sees it. */
  receive: (actions: AnyAction[] | AnyAction) => void;
  undo: () => RevertResult;
  redo: () => RevertResult;
  subscribe: (fn: (actions: AnyAction[]) => void) => Unsubscribe;
  /** Closes the history's stream groups, then the outbound pipe's. */
  flushStreamBuffers: () => void;
  destroy: () => void;
};

type RevertUnit = { label: string | null; historyEntries: number };

const hasChangeActionTypes = arrayHas<string>(ChangeActionTypes);
const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);

/** The creations whose ids a caller needs back, since the generators draw them inside. */
const hasCreateActionTypes = arrayHas<string>([
  'table.add',
  'column.add',
  'memo.add',
  'index.add',
  'indexColumn.add',
  'relationship.add',
]);

/**
 * Counts the entries pushed rather than reading the cursor, which stops moving
 * once the history is at its limit. An undo replays past the history's input,
 * so push is reached only by a batch the history took in.
 */
function createCountingHistory(history: History) {
  let pushes = 0;
  // Zero is the history's own word for no limit.
  let limit = 0;

  const counting: History = Object.freeze({
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
      pushes++;
      history.push(command);
    },
    clear: history.clear,
    setLimit: newLimit => {
      limit = newLimit;
      history.setLimit(newLimit);
    },
    clone: history.clone,
  });

  return {
    history: counting,
    getPushes: () => pushes,
    getLimit: () => limit,
  };
}

function focusActions(focus?: DispatchFocus): CompositionActions {
  if (!focus) return [];

  const { tableId, columnId, focusType } = focus;

  if (columnId !== undefined) {
    return [
      focusColumnAction({
        tableId,
        columnId,
        focusType,
        $mod: false,
        shiftKey: false,
      }),
    ];
  }

  return [focusTableAction({ tableId, focusType })];
}

/**
 * A collaborating editor with no screen: the element's store pipeline, driven
 * by dispatches instead of a pointer. Stream buffers close when a dispatch
 * ends rather than after a quiet period, so one dispatch is one outbound batch.
 */
export function createPeerStore({
  nickname,
  toWidth = defaultToWidth,
  presence = true,
  readonly = false,
}: PeerStoreOptions): PeerStore {
  let counter: ReturnType<typeof createCountingHistory> | null = null;
  const rxStore = createRxStore(createEngineContext({ toWidth }), {
    manualStreamFlush: true,
    observable: false,
    getHistory: options => {
      counter = createCountingHistory(createHistory(options));
      return counter.history;
    },
  });
  const getPushes = () => counter?.getPushes() ?? 0;
  const getLimit = () => counter?.getLimit() ?? 0;
  const sharedStore = createSharedStore(
    rxStore,
    { getNickname: () => nickname },
    { manualStreamFlush: true }
  );
  const flusher = createStreamFlusher(rxStore, sharedStore);
  const subscribers = new Set<(actions: AnyAction[]) => void>();
  const editorId = rxStore.state.editor.id;

  let isReadonly = readonly;
  let destroyed = false;
  let sinkUnsubscribe: Unsubscribe | null = null;
  let externalSubscribed = false;
  let batches = 0;
  let revertLog: RevertUnit[] = [];
  let redoStack: RevertUnit[] = [];

  // A peer has no screen. Reported empty before any load, the origin stays
  // where the file put it, and the load never reaches the pull's frozen view
  // lookup, whose reactive proxy throws in Node for want of the DOM Node global.
  rxStore.dispatchSync(changeViewportAction({ width: 0, height: 0 }));

  const focusPresence: FocusPresence | null = presence
    ? createFocusPresence(rxStore)
    : null;

  /**
   * The one subscription the shared store ever gets. It opens the circuit, so
   * a headless session with nobody listening still drains the outbound pipe,
   * and it counts the batches that carry document changes.
   */
  const openSink = () => {
    if (sinkUnsubscribe) return;

    sinkUnsubscribe = sharedStore.subscribe(actions => {
      if (actions.some(action => hasChangeActionTypes(action.type))) {
        batches++;
      }

      for (const fn of Array.from(subscribers)) {
        safeCallback(fn, actions);
      }
    });
  };

  const assertUsable = (operation: string) => {
    if (destroyed) {
      throw new PeerStoreError(PeerStoreErrorCode.destroyed, operation);
    }
  };

  const assertWritable = (operation: string) => {
    assertUsable(operation);
    if (isReadonly) {
      throw new PeerStoreError(PeerStoreErrorCode.readonly, operation);
    }
  };

  /**
   * Lets go of the oldest units once the history has dropped their entries at
   * its limit, so an undo never names a dispatch it can no longer revert, then
   * of the oldest units that made no entry, so the log stays bounded too.
   */
  const trimRevertLog = () => {
    const limit = getLimit();
    if (!limit) return;

    let entries = revertLog.reduce(
      (sum, { historyEntries }) => sum + historyEntries,
      0
    );
    while (entries > limit) {
      entries -= revertLog.shift()!.historyEntries;
    }
    // More units than the limit, with no more entries than it, means some
    // units made no entry, and the oldest of those is the one let go.
    while (revertLog.length > limit) {
      revertLog.splice(
        revertLog.findIndex(({ historyEntries }) => !historyEntries),
        1
      );
    }
  };

  const dispatch = (
    compositionActions: CompositionActions,
    options: DispatchOptions = {}
  ): DispatchReport => {
    assertWritable('dispatch');
    openSink();

    const batchesBefore = batches;
    const pushesBefore = getPushes();
    const actions = compositionActionsFlat(rxStore.state, rxStore.context, [
      ...focusActions(options.focus),
      ...compositionActions,
    ]);

    rxStore.dispatchSync(actions);

    if (actions.some(action => hasStreamActionTypes(action.type))) {
      flusher.flush();
    }

    const report: DispatchReport = {
      label: options.label ?? null,
      actions: actions.filter(action => hasChangeActionTypes(action.type)),
      createdIds: actions
        .filter(action => hasCreateActionTypes(action.type))
        .map(action => action.payload.id),
      batches: batches - batchesBefore,
      historyEntries: getPushes() - pushesBefore,
    };

    revertLog.push({
      label: report.label,
      historyEntries: report.historyEntries,
    });
    // The history drops its redo side only when an entry is pushed, so the
    // units that mirror it do the same.
    if (report.historyEntries) {
      redoStack = [];
    }
    trimRevertLog();

    return report;
  };

  const replay = (unit: RevertUnit, step: () => void) => {
    for (let i = 0; i < unit.historyEntries; i++) {
      step();
    }
    // A reverted color is a stream action again, held back until flushed.
    flusher.flush();
  };

  const undo = (): RevertResult => {
    assertWritable('undo');
    openSink();

    const skipped: string[] = [];
    let unit = revertLog.pop();

    while (unit && !unit.historyEntries) {
      if (unit.label !== null) skipped.push(unit.label);
      unit = revertLog.pop();
    }

    if (!unit) {
      return { label: null, entries: 0, skipped };
    }

    replay(unit, rxStore.undo);
    redoStack.push(unit);

    return { label: unit.label, entries: unit.historyEntries, skipped };
  };

  const redo = (): RevertResult => {
    assertWritable('redo');
    openSink();

    const unit = redoStack.pop();
    if (!unit) {
      return { label: null, entries: 0, skipped: [] };
    }

    replay(unit, rxStore.redo);
    revertLog.push(unit);

    return { label: unit.label, entries: unit.historyEntries, skipped: [] };
  };

  const setInitialValue = (value: string) => {
    assertUsable('setInitialValue');
    const safeValue = toSafeString(value);

    rxStore.dispatchSync(
      focusTableEndAction(),
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
    rxStore.resetHistory();
    revertLog = [];
    redoStack = [];
  };

  const subscribe = (fn: (actions: AnyAction[]) => void): Unsubscribe => {
    assertUsable('subscribe');
    subscribers.add(fn);

    if (!externalSubscribed) {
      externalSubscribed = true;
      if (sinkUnsubscribe) {
        // A headless dispatch opened the sink first, and the shared store sends
        // its handshake only to its first subscriber, so ask again for this one.
        rxStore.dispatchSync(getLWWAction());
      } else {
        openSink();
      }
    }

    return () => {
      subscribers.delete(fn);
    };
  };

  const receive = (actions: AnyAction[] | AnyAction) => {
    if (destroyed) return;
    sharedStore.dispatchSync(actions);
  };

  const flushStreamBuffers = () => {
    if (destroyed) return;
    flusher.flush();
  };

  const destroy = () => {
    if (destroyed) return;

    destroyed = true;
    focusPresence?.destroy();
    sinkUnsubscribe?.();
    sinkUnsubscribe = null;
    subscribers.clear();
    sharedStore.destroy();
    rxStore.destroy();
    // Only now, when no action reaches a reducer, can no new expiry be set.
    clearSharedTrackers(rxStore.state.editor);
    revertLog = [];
    redoStack = [];
  };

  return Object.freeze({
    editorId,
    get value() {
      return toJson(rxStore.state);
    },
    get state() {
      return rxStore.state;
    },
    get isReadonly() {
      return isReadonly;
    },
    get isDestroyed() {
      return destroyed;
    },
    setReadonly: (value: boolean) => {
      isReadonly = value;
    },
    setInitialValue,
    mergeClock: (version: number) => {
      rxStore.context.clock.merge(version);
    },
    dispatch,
    receive,
    undo,
    redo,
    subscribe,
    flushStreamBuffers,
    destroy,
  });
}
