import { type ActionTool, AgentToolError } from '@dineug/erd-editor/agent.js';
import { PeerStoreError } from '@dineug/erd-editor/peer.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { messageOf, SessionError } from '@/errors';
import { log } from '@/log';
import { type WithMode } from '@/session/manager';
import {
  type Notes,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import { ToolError } from '@/tools/errors';

export const UNCHANGED_NOTE =
  'The call changed nothing, since the document already held that value, so erd_undo passes over it.';

export const NO_ENTRY_NOTE =
  'The call made no undo entry, so erd_undo passes over it.';

/** Compact JSON as the one text block; empty notes are left out. */
export function jsonResult(payload: Record<string, unknown>): CallToolResult {
  const { notes, ...rest } = payload;
  const body =
    Array.isArray(notes) && notes.length ? { ...rest, notes } : { ...rest };
  return { content: [{ type: 'text', text: JSON.stringify(body) }] };
}

/** A read's text as it is, any notes in a second block. */
export function textResult(text: string, notes: Notes): CallToolResult {
  return {
    content: [
      { type: 'text', text },
      ...(notes.length
        ? [{ type: 'text' as const, text: JSON.stringify({ notes }) }]
        : []),
    ],
  };
}

/** A refusal with the code that says what kind; anything unexpected is internal and logged. */
export function errorResult(error: unknown): CallToolResult {
  let code: string;
  // readDocument still refuses with AgentToolError, so that arm stays until
  // the read moves into this package.
  if (
    error instanceof ToolError ||
    error instanceof PeerStoreError ||
    error instanceof AgentToolError ||
    error instanceof SessionError
  ) {
    code = error.code;
  } else {
    code = 'internal';
    log('a tool call failed', error);
  }
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: { code, message: messageOf(error) } }),
      },
    ],
  };
}

/** Why erd_undo will not revert this call, or undefined when it will. */
function undoNote(tool: ActionTool, outcome: ToolOutcome): string | undefined {
  const { run } = outcome;
  if (run.historyEntries) return undefined;
  if (!tool.undoable) {
    return 'erd_undo cannot revert this call: the editor keeps no undo entry for it.';
  }
  return run.batches ? NO_ENTRY_NOTE : UNCHANGED_NOTE;
}

export function toolRunResult(
  tool: ActionTool,
  outcome: WithMode<ToolOutcome>
): CallToolResult {
  const { run, mode, notes } = outcome;
  const note = undoNote(tool, outcome);

  return jsonResult({
    tool: run.tool,
    mode,
    createdIds: run.createdIds,
    batches: run.batches,
    historyEntries: run.historyEntries,
    ...(note ? { undoable: false, undoNote: note } : {}),
    ...(run.mismatch ? { mismatch: run.mismatch } : {}),
    notes,
  });
}

export function undoResult(
  tool: 'erd_undo' | 'erd_redo',
  outcome: WithMode<UndoOutcome>
): CallToolResult {
  const { result, mode, notes } = outcome;
  const verb = tool === 'erd_undo' ? 'undo' : 'redo';

  return jsonResult({
    tool,
    mode,
    toolName: result.label,
    entries: result.entries,
    ...(result.skipped.length ? { skipped: result.skipped } : {}),
    notes: result.label
      ? notes
      : [
          ...notes,
          `Nothing to ${verb}: this agent has no edit left to ${verb} on this document.`,
        ],
  });
}
