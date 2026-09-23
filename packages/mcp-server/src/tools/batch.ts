import {
  createPeerStore,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';
import { isPlainObject } from 'es-toolkit';

import { ToolError, ToolErrorCode } from '@/tools/errors';
import { type ActionTool, toolByName } from '@/tools/registry';
import { runTool, type ToolRun } from '@/tools/run';

export const BATCH_TOOL = 'erd_batch';

/** The most operations one call takes. */
export const MAX_OPERATIONS = 100;

export type BatchStep = {
  tool: string;
  as?: string;
  createdIds: string[];
  mismatch?: ToolRun['mismatch'];
};

export type BatchRun = {
  tool: typeof BATCH_TOOL;
  /** The document changes every operation made, in dispatch order. */
  actions: AnyAction[];
  createdIds: string[];
  steps: BatchStep[];
  batches: number;
  historyEntries: number;
  /** The operations whose tool the editor keeps no undo entry for. */
  withoutUndo: number[];
};

/** What an operation's as may be, the name its $name references use. */
export const OPERATION_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const REFERENCE = /^\$([A-Za-z_][A-Za-z0-9_]*)(?:\.(\d+|last))?$/;

/**
 * A batch that failed on the peer after its rehearsal passed, so the peer may
 * hold part of it: the session drops the peer's state rather than keep it.
 */
export class BatchInterrupted extends Error {
  constructor(cause: unknown) {
    super(
      `erd_batch stopped part way on the document after its rehearsal passed, so nothing of it was kept: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause }
    );
    this.name = 'BatchInterrupted';
  }
}

const invalid = (message: string) =>
  new ToolError(ToolErrorCode.invalidArgs, BATCH_TOOL, message);

type Checked = { tool: ActionTool; as?: string; args: Record<string, unknown> };

/** The operations as the batch runs them, every shape refused before anything runs. */
function checkOperations(operations: unknown): Checked[] {
  if (!Array.isArray(operations) || !operations.length) {
    throw invalid('operations must be a non-empty list');
  }
  if (operations.length > MAX_OPERATIONS) {
    throw invalid(
      `operations holds ${operations.length} entries; one call takes at most ${MAX_OPERATIONS}`
    );
  }

  const names = new Set<string>();
  return operations.map((entry: unknown, at) => {
    const where = `operations[${at}]`;
    if (!isPlainObject(entry)) throw invalid(`${where} must be an object`);
    const { tool: name, as, args = {} } = entry as Record<string, unknown>;
    const tool = typeof name === 'string' ? toolByName.get(name) : undefined;
    if (!tool) {
      throw invalid(
        `${where}.tool ${String(name)} is no edit tool; a batch runs the erd_ edit tools only`
      );
    }
    if (as !== undefined) {
      if (typeof as !== 'string' || !OPERATION_NAME.test(as)) {
        throw invalid(
          `${where}.as must be a name of letters, digits and underscores`
        );
      }
      if (names.has(as)) throw invalid(`${where}.as ${as} is used twice`);
      names.add(as);
    }
    if (!isPlainObject(args)) throw invalid(`${where}.args must be an object`);
    return { tool, as, args: args as Record<string, unknown> };
  });
}

/**
 * The arguments with every $name reference in an entity id argument replaced
 * by the id it names. Other arguments are values, never references.
 */
function resolveArgs(
  { tool, args }: Checked,
  created: ReadonlyMap<string, string[]>,
  at: number
): Record<string, unknown> {
  const resolve = (value: unknown, argName: string): unknown => {
    const match = typeof value === 'string' ? REFERENCE.exec(value) : undefined;
    if (!match) return value;
    const [, name, nth = '0'] = match;
    const ids = created.get(name);
    const where = `operations[${at}] ${tool.name}: ${argName} ${value}`;
    if (!ids) {
      throw invalid(`${where} names no earlier operation; name it with as`);
    }
    const id = ids[nth === 'last' ? ids.length - 1 : Number(nth)];
    if (id === undefined) {
      throw invalid(
        `${where} asks for id ${nth}, but ${name} created ${ids.length}`
      );
    }
    return id;
  };

  const resolved = { ...args };
  for (const { name, kind } of tool.args) {
    const value = resolved[name];
    if (kind.type === 'entityId') {
      resolved[name] = resolve(value, name);
    } else if (kind.type === 'entityIdList' && Array.isArray(value)) {
      resolved[name] = value.map(id => resolve(id, name));
    } else if (kind.type === 'tablePositions' && Array.isArray(value)) {
      resolved[name] = value.map(entry =>
        isPlainObject(entry)
          ? { ...entry, tableId: resolve(entry.tableId, `${name}.tableId`) }
          : entry
      );
    }
  }
  return resolved;
}

/** A refusal inside the batch, named after the operation that made it. */
function inOperation(error: unknown, at: number, tool: string): unknown {
  if (!(error instanceof ToolError) || error.tool === BATCH_TOOL) return error;
  return new ToolError(
    error.code,
    BATCH_TOOL,
    `operations[${at}] ${tool}: ${error.message}`
  );
}

function play(peer: PeerStore, operations: Checked[]): BatchRun {
  const created = new Map<string, string[]>();
  const batch: BatchRun = {
    tool: BATCH_TOOL,
    actions: [],
    createdIds: [],
    steps: [],
    batches: 0,
    historyEntries: 0,
    withoutUndo: [],
  };

  operations.forEach((operation, at) => {
    const { tool, as } = operation;
    let run: ToolRun;
    try {
      run = runTool(peer, tool.name, resolveArgs(operation, created, at));
    } catch (error) {
      throw inOperation(error, at, tool.name);
    }
    if (as) created.set(as, run.createdIds);

    batch.actions.push(...run.actions);
    batch.createdIds.push(...run.createdIds);
    batch.batches += run.batches;
    batch.historyEntries += run.historyEntries;
    if (!tool.undoable) batch.withoutUndo.push(at);
    batch.steps.push({
      tool: tool.name,
      ...(as ? { as } : {}),
      createdIds: run.createdIds,
      ...(run.mismatch ? { mismatch: run.mismatch } : {}),
    });
  });
  return batch;
}

/**
 * Runs the operations in order as one edit, all of them or none: they run on
 * a copy of the document first, so a refusal leaves the document untouched,
 * then on the peer as one undo unit, which one erd_undo reverts.
 */
export function runBatch(peer: PeerStore, operations: unknown): BatchRun {
  if (peer.isDestroyed) {
    throw new PeerStoreError(PeerStoreErrorCode.destroyed, BATCH_TOOL);
  }
  if (peer.isReadonly) {
    throw new PeerStoreError(PeerStoreErrorCode.readonly, BATCH_TOOL);
  }
  const checked = checkOperations(operations);

  const rehearsal = createPeerStore({ nickname: BATCH_TOOL, presence: false });
  try {
    rehearsal.setInitialValue(peer.value);
    play(rehearsal, checked);
  } finally {
    rehearsal.destroy();
  }

  try {
    return peer.group(BATCH_TOOL, () => play(peer, checked));
  } catch (error) {
    throw new BatchInterrupted(error);
  }
}
