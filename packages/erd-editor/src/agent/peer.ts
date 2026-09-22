import { toJson } from '@dineug/erd-editor-schema';
import {
  type AnyAction,
  type CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';

import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { createFocusPresence, type FocusPresence } from '@/agent/presence';
import { readDocument, type ReadFormat } from '@/agent/read';
import {
  type ActionTool,
  type ExpectedCount,
  type ToolArgValues,
  toolByName,
} from '@/agent/registry';
import { createStreamFlusher } from '@/agent/streamFlush';
import { defaultToWidth } from '@/agent/toWidth';
import { validateToolArgs } from '@/agent/validate';
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
import { createRxStore } from '@/engine/rx-store';
import { createSharedStore } from '@/engine/shared-store';
import type { RootState } from '@/engine/state';
import type { Unsubscribe } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { safeCallback } from '@/utils/safeCallback';
import { toSafeString } from '@/utils/validation';

export type AgentPeerOptions = {
  nickname: string;
  toWidth?: (text: string) => number;
  /** Sends the focused cell to the other peers. A headless session turns it off. */
  presence?: boolean;
  /** Refuses every tool call, undo and redo, as a readonly document does. */
  readonly?: boolean;
};

export type ToolRun = {
  tool: string;
  /** The document changes the call made, version stamped, in dispatch order. */
  actions: AnyAction[];
  createdIds: string[];
  batches: number;
  historyEntries: number;
  /** Set when the measured counts fall outside what the registry declared. */
  mismatch?: { expectedBatches: string; expectedHistory: string };
};

/**
 * What an undo or redo reverted: the tool call, how many history entries it
 * took, and the calls passed over because the engine made them no undo entry.
 * A null tool name means there was nothing left to revert.
 */
export type UndoResult = {
  toolName: string | null;
  entries: number;
  skipped: string[];
};

export type AgentPeer = {
  readonly editorId: string;
  /** The document as the element would save it. */
  readonly value: string;
  /** The live state, for readers that serialize it another way. */
  readonly state: RootState;
  /** The document in a read format, as readDocument serializes any state. */
  read: (format: ReadFormat, vendor?: string) => string;
  readonly isReadonly: boolean;
  setReadonly: (readonly: boolean) => void;
  /**
   * Replaces the document and forgets every undo entry and tool record with
   * it, since those were taken against the old one. The one reseed operation.
   */
  setInitialValue: (value: string) => void;
  mergeClock: (version: number) => void;
  runTool: (name: string, args?: unknown) => Promise<ToolRun>;
  undo: () => Promise<UndoResult>;
  redo: () => Promise<UndoResult>;
  subscribe: (fn: (actions: AnyAction[]) => void) => Unsubscribe;
  /** Applies a peer's batch now, so a read right after sees it. */
  dispatch: (actions: AnyAction[] | AnyAction) => void;
  destroy: () => void;
};

type ToolRecord = { name: string; historyEntries: number };

const hasChangeActionTypes = arrayHas<string>(ChangeActionTypes);
const hasStreamActionTypes = arrayHas<string>(StreamActionTypes);

/** The creations whose ids an agent needs back, since the generators draw them inside. */
const hasCreateActionTypes = arrayHas<string>([
  'table.add',
  'column.add',
  'memo.add',
  'index.add',
  'indexColumn.add',
  'relationship.add',
]);

const inRange = (count: number, expected: ExpectedCount) =>
  typeof expected === 'number'
    ? count === expected
    : expected.min <= count && count <= expected.max;

const formatCount = (expected: ExpectedCount) =>
  typeof expected === 'number'
    ? String(expected)
    : `${expected.min}..${expected.max}`;

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

function focusActions(
  tool: ActionTool,
  values: ToolArgValues
): CompositionActions {
  const { focus } = tool;
  if (!focus) return [];

  const tableId = values[focus.tableArg];

  if (focus.kind === 'column' && focus.columnArg) {
    return [
      focusColumnAction({
        tableId,
        columnId: values[focus.columnArg],
        focusType: focus.focusType,
        $mod: false,
        shiftKey: false,
      }),
    ];
  }

  return [focusTableAction({ tableId, focusType: focus.focusType })];
}

/**
 * A collaborating editor with no screen: the element's store pipeline, driven
 * by registry tools instead of a pointer. Stream buffers close when a call
 * ends rather than after a quiet period, so one call is one outbound batch.
 */
export function createAgentPeer({
  nickname,
  toWidth = defaultToWidth,
  presence = true,
  readonly = false,
}: AgentPeerOptions): AgentPeer {
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
  let toolLog: ToolRecord[] = [];
  let redoStack: ToolRecord[] = [];

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

  const assertUsable = (name: string) => {
    if (destroyed) {
      throw new AgentToolError(
        AgentToolErrorCode.destroyed,
        name,
        'this document session was closed; open the document again'
      );
    }
  };

  const assertWritable = (name: string) => {
    assertUsable(name);
    if (isReadonly) {
      throw new AgentToolError(
        AgentToolErrorCode.readonly,
        name,
        'the document is readonly, so no edit was made'
      );
    }
  };

  /**
   * Lets go of the oldest records once the history has dropped their entries
   * at its limit, so an undo never names a call it can no longer revert, then
   * of the oldest calls that made no entry, so the records stay bounded too.
   */
  const trimToolLog = () => {
    const limit = getLimit();
    if (!limit) return;

    let entries = toolLog.reduce(
      (sum, { historyEntries }) => sum + historyEntries,
      0
    );
    while (entries > limit) {
      entries -= toolLog.shift()!.historyEntries;
    }
    // More records than the limit, with no more entries than it, means some
    // records made no entry, and the oldest of those is the one let go.
    while (toolLog.length > limit) {
      toolLog.splice(
        toolLog.findIndex(({ historyEntries }) => !historyEntries),
        1
      );
    }
  };

  const runTool = async (name: string, args?: unknown): Promise<ToolRun> => {
    assertUsable(name);
    const tool = toolByName.get(name);
    if (!tool) {
      throw new AgentToolError(
        AgentToolErrorCode.unknownTool,
        name,
        `no tool is named ${name}`
      );
    }
    assertWritable(name);

    const values = validateToolArgs(tool, args, rxStore.state);
    openSink();

    const batchesBefore = batches;
    const pushesBefore = getPushes();
    const actions = compositionActionsFlat(rxStore.state, rxStore.context, [
      ...focusActions(tool, values),
      ...tool.toActions(values),
    ]);

    rxStore.dispatchSync(actions);

    if (actions.some(action => hasStreamActionTypes(action.type))) {
      flusher.flush();
    }

    const run: ToolRun = {
      tool: name,
      actions: actions.filter(action => hasChangeActionTypes(action.type)),
      createdIds: actions
        .filter(action => hasCreateActionTypes(action.type))
        .map(action => action.payload.id),
      batches: batches - batchesBefore,
      historyEntries: getPushes() - pushesBefore,
    };

    if (
      !inRange(run.batches, tool.expectedBatches) ||
      !inRange(run.historyEntries, tool.expectedHistory)
    ) {
      run.mismatch = {
        expectedBatches: formatCount(tool.expectedBatches),
        expectedHistory: formatCount(tool.expectedHistory),
      };
    }

    toolLog.push({ name, historyEntries: run.historyEntries });
    // The history drops its redo side only when an entry is pushed, so the
    // records that mirror it do the same.
    if (run.historyEntries) {
      redoStack = [];
    }
    trimToolLog();

    return run;
  };

  const replay = (record: ToolRecord, step: () => void) => {
    for (let i = 0; i < record.historyEntries; i++) {
      step();
    }
    // A reverted color is a stream action again, held back until flushed.
    flusher.flush();
  };

  const undo = async (): Promise<UndoResult> => {
    assertWritable('undo');
    openSink();

    const skipped: string[] = [];
    let record = toolLog.pop();

    while (record && !record.historyEntries) {
      skipped.push(record.name);
      record = toolLog.pop();
    }

    if (!record) {
      return { toolName: null, entries: 0, skipped };
    }

    replay(record, rxStore.undo);
    redoStack.push(record);

    return {
      toolName: record.name,
      entries: record.historyEntries,
      skipped,
    };
  };

  const redo = async (): Promise<UndoResult> => {
    assertWritable('redo');
    openSink();

    const record = redoStack.pop();
    if (!record) {
      return { toolName: null, entries: 0, skipped: [] };
    }

    replay(record, rxStore.redo);
    toolLog.push(record);

    return {
      toolName: record.name,
      entries: record.historyEntries,
      skipped: [],
    };
  };

  const setInitialValue = (value: string) => {
    assertUsable('setInitialValue');
    const safeValue = toSafeString(value);

    rxStore.dispatchSync(
      focusTableEndAction(),
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
    rxStore.resetHistory();
    toolLog = [];
    redoStack = [];
  };

  const subscribe = (fn: (actions: AnyAction[]) => void): Unsubscribe => {
    assertUsable('subscribe');
    subscribers.add(fn);

    if (!externalSubscribed) {
      externalSubscribed = true;
      if (sinkUnsubscribe) {
        // A headless call opened the sink first, and the shared store sends
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

  const dispatch = (actions: AnyAction[] | AnyAction) => {
    if (destroyed) return;
    sharedStore.dispatchSync(actions);
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
    toolLog = [];
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
    read: (format: ReadFormat, vendor?: string) => {
      assertUsable('erd_read');
      return readDocument(rxStore.state, format, vendor);
    },
    get isReadonly() {
      return isReadonly;
    },
    setReadonly: (value: boolean) => {
      isReadonly = value;
    },
    setInitialValue,
    mergeClock: (version: number) => {
      rxStore.context.clock.merge(version);
    },
    runTool,
    undo,
    redo,
    subscribe,
    dispatch,
    destroy,
  });
}
