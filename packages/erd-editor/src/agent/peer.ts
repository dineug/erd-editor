import type { AnyAction } from '@dineug/r-html';

import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { readDocument, type ReadFormat } from '@/agent/read';
import {
  type ActionTool,
  type ExpectedCount,
  type ToolArgValues,
  toolByName,
} from '@/agent/registry';
import { validateToolArgs } from '@/agent/validate';
import {
  createPeerStore,
  type DispatchFocus,
  PeerStoreError,
  PeerStoreErrorCode,
  type PeerStoreOptions,
  type RevertResult,
} from '@/engine/peer-store';
import type { RootState } from '@/engine/state';
import type { Unsubscribe } from '@/internal-types';

export type AgentPeerOptions = PeerStoreOptions;

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

const inRange = (count: number, expected: ExpectedCount) =>
  typeof expected === 'number'
    ? count === expected
    : expected.min <= count && count <= expected.max;

const formatCount = (expected: ExpectedCount) =>
  typeof expected === 'number'
    ? String(expected)
    : `${expected.min}..${expected.max}`;

const refusal = (code: PeerStoreErrorCode, name: string) =>
  new AgentToolError(code, name, new PeerStoreError(code, name).message);

/** Reports a peer store refusal as the tool error the MCP server answers with. */
function asAgentError<T>(name: string, call: () => T): T {
  try {
    return call();
  } catch (error) {
    if (error instanceof PeerStoreError) throw refusal(error.code, name);
    throw error;
  }
}

function toFocus(
  tool: ActionTool,
  values: ToolArgValues
): DispatchFocus | undefined {
  const { focus } = tool;
  if (!focus) return undefined;

  const tableId = values[focus.tableArg];
  const { focusType } = focus;

  return focus.kind === 'column' && focus.columnArg
    ? { tableId, columnId: values[focus.columnArg], focusType }
    : { tableId, focusType };
}

const toUndoResult = ({ label, entries, skipped }: RevertResult) => ({
  toolName: label,
  entries,
  skipped,
});

/**
 * The registry's tools over a peer store: one tool per call as one dispatch,
 * refused in the order destroyed, unknown tool, readonly, arguments, with the
 * measured counts held against the declared ones.
 */
export function createAgentPeer(options: AgentPeerOptions): AgentPeer {
  const store = createPeerStore(options);

  const assertUsable = (name: string) => {
    if (store.isDestroyed) throw refusal(PeerStoreErrorCode.destroyed, name);
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
    if (store.isReadonly) throw refusal(PeerStoreErrorCode.readonly, name);

    const values = validateToolArgs(tool, args, store.state);
    const report = store.dispatch(tool.toActions(values), {
      label: name,
      focus: toFocus(tool, values),
    });
    const run: ToolRun = {
      tool: name,
      actions: report.actions,
      createdIds: report.createdIds,
      batches: report.batches,
      historyEntries: report.historyEntries,
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

    return run;
  };

  return Object.freeze({
    editorId: store.editorId,
    get value() {
      return store.value;
    },
    get state() {
      return store.state;
    },
    read: (format: ReadFormat, vendor?: string) => {
      assertUsable('erd_read');
      return readDocument(store.state, format, vendor);
    },
    get isReadonly() {
      return store.isReadonly;
    },
    setReadonly: store.setReadonly,
    setInitialValue: (value: string) =>
      asAgentError('setInitialValue', () => store.setInitialValue(value)),
    mergeClock: store.mergeClock,
    runTool,
    undo: async () => toUndoResult(asAgentError('undo', store.undo)),
    redo: async () => toUndoResult(asAgentError('redo', store.redo)),
    subscribe: (fn: (actions: AnyAction[]) => void) =>
      asAgentError('subscribe', () => store.subscribe(fn)),
    dispatch: store.receive,
    destroy: store.destroy,
  });
}
