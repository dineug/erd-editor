import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';

/** Where an action reached the hub from; drops at a join are counted per source. */
export type ActionSource = 'webview' | 'peer';

/** One delivery held back while its peer was inside the join window. */
export type QueuedBatch = { source: ActionSource; actions: unknown[] };

/** Dropped actions counted by source, then by action type. */
export type DropCounts = Partial<Record<ActionSource, Record<string, number>>>;

/** The debounceTime on the replica's change stream, the least a save can lag a batch. */
export const REPLICA_DEBOUNCE_MS = 200;

/**
 * The replica debounces its change stream by 200 ms and two IPC hops follow,
 * so a save normally lands well inside this after the last change.
 */
export const JOIN_QUIET_CAP_MS = 500;

/** Shared action types that change no document byte, so no replica save follows them. */
const NON_CHANGE_ACTION_TYPES = new Set([
  'editor.getLWW',
  'editor.mergeLWW',
  'editor.sharedMouseTracker',
  'editor.sharedFocusTracker',
  'editor.sharedSelectionTracker',
  'editor.sharedDragSelectTracker',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Lamport version an action carries, or undefined when it carries none. */
export function actionVersion(action: unknown): number | undefined {
  return isRecord(action) && Number.isFinite(action.version)
    ? (action.version as number)
    : undefined;
}

export function actionType(action: unknown): string {
  return isRecord(action) && typeof action.type === 'string'
    ? action.type
    : 'unknown';
}

/** Anything not known to leave the bytes alone counts, so a stranger only costs a wait. */
export function hasChangeAction(actions: unknown[]): boolean {
  return actions.some(
    action => !NON_CHANGE_ACTION_TYPES.has(actionType(action))
  );
}

/** The highest version among current and the actions; a version-less action is skipped. */
export function maxVersion(current: number, actions: unknown[]): number {
  let max = current;
  for (const action of actions) {
    const version = actionVersion(action);
    if (version !== undefined && version > max) max = version;
  }
  return max;
}

/**
 * Whether a document is between a change and the replica saves it causes.
 * Every ready webview runs its own replica, so the last expected save, not
 * the first, is the one that makes the content current.
 */
export type QuietState = {
  pending: boolean;
  saves: number;
  /** A save reaching the hub before this instant was sent before its replica held the latest peer batch. */
  countFrom: number;
  /** Completed by the save that settles the pending change; null while none is pending. */
  settled: Deferred.Deferred<void> | null;
};

export function createQuietState(): QuietState {
  return {
    pending: false,
    saves: 0,
    countFrom: Number.NEGATIVE_INFINITY,
    settled: null,
  };
}

/**
 * The hub sends a peer batch at now, so a save holding it cannot arrive within
 * the replica debounce. A relay can reach the hub after its replica saved, as
 * both leave the webview at once, so a relay bounds nothing.
 */
export function noteChange(
  state: QuietState,
  source: ActionSource,
  now: number
): void {
  state.pending = true;
  state.saves = 0;
  state.settled ??= Deferred.makeUnsafe<void>();
  if (source === 'peer') {
    state.countFrom = Math.max(state.countFrom, now + REPLICA_DEBOUNCE_MS);
  }
}

/** A save outside a pending change, or too early to hold the latest peer batch, is ignored. */
export function noteSave(
  state: QuietState,
  expected: number,
  now: number
): void {
  if (!state.pending || now < state.countFrom) return;

  state.saves++;
  recount(state, expected);
}

/**
 * Settles a pending change once its counted saves cover expected. A closed
 * webview lowers expected without a save, so its removal checks again here.
 */
export function recount(state: QuietState, expected: number): void {
  if (!state.pending || state.saves < Math.max(1, expected)) return;

  state.pending = false;
  const settled = state.settled;
  state.settled = null;
  if (settled) Deferred.doneUnsafe(settled, Effect.void);
}

/**
 * True at once when no change is pending or on the save that settles it, and
 * false at capMs. Never fails: join captures what the document holds either
 * way, while save refuses to write bytes that may lack an edit.
 */
export function waitForQuiet(
  state: QuietState,
  capMs: number = JOIN_QUIET_CAP_MS
): Effect.Effect<boolean> {
  return Effect.suspend(() => {
    const settled = state.settled;
    if (!state.pending || !settled) return Effect.succeed(true);

    return Effect.raceFirst(
      Deferred.await(settled).pipe(Effect.as(true)),
      Effect.sleep(Duration.millis(capMs)).pipe(Effect.as(false))
    );
  });
}

/**
 * Filters what was queued before the snapshot: what it holds (version up to
 * snapshotVersion) goes, and so does a version-less action, since a relative
 * move applied twice moves twice and nothing tells if the snapshot holds it.
 */
export function filterJoinQueue(
  queue: QueuedBatch[],
  snapshotVersion: number
): { batches: QueuedBatch[]; dropped: DropCounts; droppedCount: number } {
  const batches: QueuedBatch[] = [];
  const dropped: DropCounts = {};
  let droppedCount = 0;

  for (const { source, actions } of queue) {
    const kept = actions.filter(action => {
      const version = actionVersion(action);
      if (version !== undefined && version > snapshotVersion) return true;

      const counts = (dropped[source] ??= {});
      const type = actionType(action);
      counts[type] = (counts[type] ?? 0) + 1;
      droppedCount++;
      return false;
    });
    if (kept.length) batches.push({ source, actions: kept });
  }

  return { batches, dropped, droppedCount };
}
