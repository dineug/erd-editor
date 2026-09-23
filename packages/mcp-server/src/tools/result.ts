import { PeerStoreError } from '@dineug/erd-editor/peer.js';
import { McpSchema } from 'effect/unstable/ai';

import { messageOf, SessionError } from '@/errors';
import { type WithMode } from '@/session/manager';
import {
  type BatchOutcome,
  type Notes,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import { ToolError } from '@/tools/errors';
import { type ActionTool } from '@/tools/registry';

export const UNCHANGED_NOTE =
  'The call changed nothing, since the document already held that value, so erd_undo passes over it.';

export const NO_ENTRY_NOTE =
  'The call made no undo entry, so erd_undo passes over it.';

/** What a refused call answers, as the one text block of an error result. */
export type Refusal = { error: { code: string; message: string } };

/**
 * The body of a result, empty notes left out. The toolkit writes it as one
 * compact JSON text block, in the order its success schema declares the keys.
 */
export function jsonBody<T extends { readonly notes?: Notes }>(
  payload: T
): Omit<T, 'notes'> & { notes?: Notes } {
  const { notes, ...rest } = payload;
  return Array.isArray(notes) && notes.length
    ? { ...rest, notes }
    : { ...rest };
}

/** A read's text as it is, any notes in a second block. */
export function textResult(
  text: string,
  notes: Notes
): McpSchema.CallToolResult {
  return new McpSchema.CallToolResult({
    content: [
      { type: 'text', text },
      ...(notes.length
        ? [{ type: 'text' as const, text: JSON.stringify({ notes }) }]
        : []),
    ],
  });
}

/** A refusal whose code says what kind; anything else is internal, which the caller logs. */
export function isRefusal(
  error: unknown
): error is ToolError | PeerStoreError | SessionError {
  return (
    error instanceof ToolError ||
    error instanceof PeerStoreError ||
    error instanceof SessionError
  );
}

export function refusal(error: unknown): Refusal {
  return {
    error: {
      code: isRefusal(error) ? error.code : 'internal',
      message: messageOf(error),
    },
  };
}

/** A refusal as a result of its own, for the read tools, which the toolkit does not answer. */
export function errorResult(refused: Refusal): McpSchema.CallToolResult {
  return new McpSchema.CallToolResult({
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(refused) }],
  });
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
) {
  const { run, mode, notes } = outcome;
  const note = undoNote(tool, outcome);

  return jsonBody({
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

/** A batch's count runs into the dozens, which an agent once read as that many undos. */
const BATCH_ENTRIES_NOTE =
  'historyEntries counts the editor history entries inside the batch, not erd_undo calls.';

/** How much of the batch one erd_undo reverts, said on every batch that made an entry. */
function batchUndoNote({ run }: BatchOutcome): string {
  if (!run.historyEntries) {
    return run.batches ? NO_ENTRY_NOTE : UNCHANGED_NOTE;
  }
  if (!run.withoutUndo.length) {
    return `One erd_undo reverts this whole batch. ${BATCH_ENTRIES_NOTE}`;
  }
  const skipped = run.withoutUndo
    .map(at => `operations[${at}] ${run.steps[at].tool}`)
    .join(', ');
  return `One erd_undo reverts this batch, except ${skipped}: the editor keeps no undo entry for those. ${BATCH_ENTRIES_NOTE}`;
}

export function batchResult(outcome: WithMode<BatchOutcome>) {
  const { run, mode, notes } = outcome;

  return jsonBody({
    tool: run.tool,
    mode,
    createdIds: run.createdIds,
    operations: run.steps,
    batches: run.batches,
    historyEntries: run.historyEntries,
    ...(run.historyEntries ? {} : { undoable: false }),
    undoNote: batchUndoNote(outcome),
    notes,
  });
}

export function undoResult(
  tool: 'erd_undo' | 'erd_redo',
  outcome: WithMode<UndoOutcome>
) {
  const { result, mode, notes } = outcome;
  const verb = tool === 'erd_undo' ? 'undo' : 'redo';

  return jsonBody({
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
