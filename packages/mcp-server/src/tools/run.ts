import {
  type ActionTool,
  type ExpectedCount,
  type ToolArgValues,
  toolByName,
} from '@dineug/erd-editor/agent.js';
import {
  type DispatchFocus,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';

import { ToolError, ToolErrorCode } from '@/tools/errors';
import { validateToolArgs } from '@/tools/validate';

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

const inRange = (count: number, expected: ExpectedCount) =>
  typeof expected === 'number'
    ? count === expected
    : expected.min <= count && count <= expected.max;

const formatCount = (expected: ExpectedCount) =>
  typeof expected === 'number'
    ? String(expected)
    : `${expected.min}..${expected.max}`;

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

/**
 * One registry tool over a peer store as one dispatch, refused in the order
 * destroyed, unknown tool, readonly, arguments, with the measured counts held
 * against the ones the registry declared.
 */
export function runTool(
  peer: PeerStore,
  name: string,
  args?: unknown
): ToolRun {
  if (peer.isDestroyed) {
    throw new PeerStoreError(PeerStoreErrorCode.destroyed, name);
  }
  const tool = toolByName.get(name);
  if (!tool) {
    throw new ToolError(
      ToolErrorCode.unknownTool,
      name,
      `no tool is named ${name}`
    );
  }
  if (peer.isReadonly) {
    throw new PeerStoreError(PeerStoreErrorCode.readonly, name);
  }

  const values = validateToolArgs(tool, args, peer.state);
  const report = peer.dispatch(tool.toActions(values), {
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
}
