import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

import { AWARENESS_FIELD } from '@/awareness';
import { refusal } from '@/errors';
import { copyJson, isRecord } from '@/json';
import {
  getLog,
  isLogEntry,
  type LogEntry,
  removeEntries,
  type Watermarks,
} from '@/log';
import type { CollaborationPort, Registers } from '@/port';
import {
  ERD_YJS_FORMAT,
  getSnapshotMap,
  readSnapshot,
  type Snapshot,
  writeSnapshot,
} from '@/snapshot';

export type CompactResult =
  | { compacted: true; generation: number }
  | {
      compacted: false;
      reason: 'not-synced' | 'no-snapshot' | 'destroyed';
    };

export type CompactOptions = {
  /**
   * Folds on its own once the log holds this many entries a fold would take.
   * No default: without it, or without synced, the binding folds only when
   * compact() is called.
   */
  compactAfter?: number;
  /** Resolves once the provider has synced; no fold, called or not, comes before it. */
  synced?: Promise<void>;
  /** How long, after synced, a compactor watches the others' Awareness before it folds on its own; 3,000 ms unless given. */
  electionGraceMs?: number;
  /** How long a fold's entries stay held, once the room is heard from again, to put back; ten minutes unless given. */
  retainMs?: number;
};

export const DEFAULT_ELECTION_GRACE_MS = 3_000;
export const DEFAULT_RETAIN_MS = 600_000;

/** The longest delay a timer keeps; Node and browsers fire a longer one at once. */
const MAX_DELAY_MS = 2 ** 31 - 1;

/** The most entries a compactor holds of its folds, the latest kept. */
export const RETAIN_LIMIT = 1_000;

/** What a compactor needs of the binding it folds for. */
export type CompactorHost = {
  doc: Y.Doc;
  /** The binding's own transaction origin, which its observers skip. */
  origin: symbol;
  port: CollaborationPort;
  awareness: Awareness | undefined;
  /** The lineage the binding joined, null until it joined one. */
  lineage: () => string | null;
  applied: () => Readonly<Watermarks>;
  /** Records a seq of a writer as applied, as the binding does an entry it wrote itself. */
  note: (by: string, seq: number) => void;
  /** Draws an id no binding has written under. */
  createId: () => string;
  /** The id the binding writes its entries under, which names it as a compactor. */
  bindingId: () => string;
  /** False once the binding stopped, as it does with error on finding its peer store destroyed. */
  usable: () => boolean;
  /** Brings the binding up to the room's snapshot, a rejoin included, as a log change does. */
  follow: () => void;
  /** Takes the binding's Awareness state out of the election. */
  withdraw: () => void;
  emitError: (error: Error) => void;
};

export type Compactor = {
  /** Whether the binding stands for the election, which its Awareness state shows, until synced rejects. */
  readonly candidate: boolean;
  compact: () => CompactResult;
  /**
   * Keeps what this binding folded that a snapshot written over its last fold
   * does not cover, before the binding follows it, to put back at the log's
   * head in the fold it makes once it has followed, which every binding reopens on.
   */
  reconcile: (snapshot: Snapshot) => void;
  /** The entries kept to put back, which a rejoin before that fold replays ahead of the log. */
  putBack: () => ReadonlyArray<LogEntry>;
  /**
   * Lets the held entries go once another write to the snapshot, in a later
   * transaction than the fold's own, left this binding's in place.
   */
  confirm: (snapshot: Snapshot, transaction: Y.Transaction) => void;
  /** Checks, once the change at hand is through, whether the log holds enough to fold. */
  schedule: () => void;
  destroy: () => void;
};

export type FoldInput = {
  /** The generation the fold writes, one past the snapshot it folds onto. */
  generation: number;
  lineage: string;
  applied: Readonly<Watermarks>;
  compactorId: string;
  runtimeValue: string;
  lww: Registers;
  version: number;
  origin: symbol;
};

/** Whether a fold up to these watermarks takes the value: an entry they hold, of another lineage, or no entry. */
const folds =
  (lineage: string, covers: Readonly<Watermarks>) =>
  (value: unknown): boolean =>
    !isLogEntry(value) ||
    value.lineage !== lineage ||
    value.seq <= (covers[value.by] ?? 0);

/**
 * Folds the log into a snapshot of the replica's state in one transaction: it
 * covers what the replica applied and deletes those entries and every entry of
 * another lineage, leaving each one past a writer's gap. Returns what it deleted.
 */
export function foldLog(doc: Y.Doc, input: FoldInput): unknown[] {
  const covers = { ...input.applied };
  let removed: unknown[] = [];

  doc.transact(() => {
    writeSnapshot(getSnapshotMap(doc), {
      format: ERD_YJS_FORMAT,
      generation: input.generation,
      seedId: input.lineage,
      compactorId: input.compactorId,
      runtimeValue: input.runtimeValue,
      lww: input.lww,
      version: input.version,
      covers,
    });
    removed = removeEntries(getLog(doc), folds(input.lineage, covers));
  }, input.origin);

  return removed;
}

type Timer = ReturnType<typeof setTimeout>;

/** One fold's entries of its lineage, its clock started at the first update from the room after it. */
type HeldFold = { entries: LogEntry[]; timer: Timer | null };

const isCandidateState = (state: Record<string, unknown>): boolean => {
  const field = state[AWARENESS_FIELD];
  return isRecord(field) && field.compactor === true;
};

/**
 * Folds the log for one binding of a peer store: on compact(), or on its own
 * past compactAfter once synced, elected and through the grace. It holds what
 * each fold took, to put back what a snapshot written over it leaves out.
 */
export function createCompactor(
  host: CompactorHost,
  {
    compactAfter,
    synced,
    electionGraceMs: graceOption = DEFAULT_ELECTION_GRACE_MS,
    retainMs: retainOption = DEFAULT_RETAIN_MS,
  }: CompactOptions
): Compactor {
  const { doc, origin, port, awareness } = host;
  const log = getLog(doc);
  const map = getSnapshotMap(doc);
  const refused: string[] = [];

  const validThreshold =
    compactAfter === undefined ||
    (Number.isInteger(compactAfter) && compactAfter > 0);
  if (!validThreshold) {
    refused.push(
      `compactAfter must be a positive integer, not ${String(compactAfter)}, so the binding folds only when asked`
    );
  }
  const delayOf = (name: string, ms: number, fallback: number) => {
    if (Number.isFinite(ms) && ms >= 0 && ms <= MAX_DELAY_MS) return ms;
    refused.push(
      `${name} must be from 0 to ${MAX_DELAY_MS} ms, not ${String(ms)}, so it is ${fallback}`
    );
    return fallback;
  };
  const electionGraceMs = delayOf(
    'electionGraceMs',
    graceOption,
    DEFAULT_ELECTION_GRACE_MS
  );
  const retainMs = delayOf('retainMs', retainOption, DEFAULT_RETAIN_MS);
  const auto =
    compactAfter !== undefined && validThreshold && synced !== undefined;
  const threshold = compactAfter ?? 0;

  let destroyed = false;
  let isSynced = synced === undefined;
  let graceOver = false;
  let graceTimer: Timer | null = null;
  let scheduled = false;
  let held: HeldFold[] = [];
  let heldCount = 0;
  let last: { compactorId: string; generation: number } | null = null;
  // What this binding puts back with its next fold, and the lineage it is of.
  let toPutBack: { lineage: string; entries: LogEntry[] } | null = null;
  let standing = auto && awareness !== undefined;
  // A fold called inside the caller's transaction writes under its origin,
  // so the binding's observers see the fold as another's write to the snapshot.
  const foldTransactions = new WeakSet<Y.Transaction>();

  const isLast = (snapshot: Snapshot) =>
    last !== null &&
    snapshot.compactorId === last.compactorId &&
    snapshot.generation === last.generation;

  const release = () => {
    for (const fold of held) {
      if (fold.timer !== null) clearTimeout(fold.timer);
    }
    held = [];
    heldCount = 0;
  };

  const expire = (fold: HeldFold) => {
    held.splice(held.indexOf(fold), 1);
    heldCount -= fold.entries.length;
  };

  const hold = (entries: LogEntry[]) => {
    if (!entries.length) return;
    held.push({ entries, timer: null });
    heldCount += entries.length;

    while (heldCount > RETAIN_LIMIT) {
      const oldest = held[0];
      const excess = heldCount - RETAIN_LIMIT;
      if (oldest.entries.length > excess) {
        oldest.entries = oldest.entries.slice(excess);
        heldCount -= excess;
        break;
      }
      if (oldest.timer !== null) clearTimeout(oldest.timer);
      held.shift();
      heldCount -= oldest.entries.length;
    }
  };

  /** A fold's clock runs from the first update the room sends after it, so one cut off holds it all the while. */
  const onAfterTransaction = (transaction: Y.Transaction) => {
    if (transaction.local) return;
    for (const fold of held) {
      if (fold.timer !== null) continue;
      fold.timer = setTimeout(() => expire(fold), retainMs);
    }
  };

  /** Whether the Awareness shows another client, which a socket that closes drops all at once. */
  const seesOthers = (room: Awareness): boolean => {
    let found = false;
    room.getStates().forEach((_state, clientId) => {
      if (clientId !== room.clientID) found = true;
    });
    return found;
  };

  // With Awareness, a compactor that shows no other client, its own socket
  // closed most likely, folds nothing on its own, since a fold made cut off
  // can win over the elected one's by its client id alone.
  let inSight = !awareness || seesOthers(awareness);

  /** The smallest client id among the Awareness states that stand for the election, this one's among them. */
  const smallestCandidate = (room: Awareness): number => {
    let found = room.clientID;
    room.getStates().forEach((state, clientId) => {
      if (clientId < found && isCandidateState(state)) found = clientId;
    });
    return found;
  };

  const elected = () =>
    !awareness || smallestCandidate(awareness) === awareness.clientID;

  const foldable = (): number => {
    const lineage = host.lineage();
    if (lineage === null) return 0;
    const takes = folds(lineage, host.applied());
    let count = 0;
    log.forEach(value => {
      if (takes(value)) count++;
    });
    return count;
  };

  const compact = (): CompactResult => {
    if (destroyed || !host.usable()) {
      return { compacted: false, reason: 'destroyed' };
    }
    if (!isSynced) return { compacted: false, reason: 'not-synced' };

    host.follow();
    // A rejoin listener may have destroyed the binding, or its peer store,
    // while it followed.
    if (!host.usable()) return { compacted: false, reason: 'destroyed' };
    const lineage = host.lineage();
    const read = readSnapshot(map);
    if (lineage === null || read.state !== 'ready') {
      return { compacted: false, reason: 'no-snapshot' };
    }

    port.flushStreamBuffers();
    // A subscriber handed a held batch may have destroyed the peer store.
    if (!host.usable()) return { compacted: false, reason: 'destroyed' };
    const back = toPutBack;
    toPutBack = null;
    if (back !== null) {
      // A key no binding has applied, so every binding reopens on this fold
      // rather than keep what it applied in the order the entries arrived.
      host.note(host.createId(), 1);
    }
    const generation = read.snapshot.generation + 1;
    const compactorId = host.bindingId();
    let removed: unknown[] = [];
    doc.transact(transaction => {
      foldTransactions.add(transaction);
      // Inserted and deleted in this one transaction, so a client takes them
      // only in the snapshot that covers them, never as entries of their own.
      if (back !== null) log.insert(0, back.entries);
      removed = foldLog(doc, {
        generation,
        lineage,
        applied: host.applied(),
        compactorId,
        runtimeValue: port.runtimeValue(),
        lww: port.getLWW(),
        version: port.getVersion(),
        origin,
      });
    }, origin);
    hold(
      removed.filter(
        (value): value is LogEntry =>
          isLogEntry(value) && value.lineage === lineage
      )
    );
    last = { compactorId, generation };
    return { compacted: true, generation };
  };

  const run = () => {
    scheduled = false;
    if (destroyed || !isSynced || !graceOver || !inSight) return;
    if (!elected() || foldable() < threshold) return;
    compact();
  };

  /** Writes the entries kept to put back at the log's head on their own, for a binding that cannot fold them. */
  const putBackAlone = () => {
    if (toPutBack === null) return;
    const { entries } = toPutBack;
    toPutBack = null;
    if (readSnapshot(map).state !== 'ready') return;
    doc.transact(() => log.insert(0, entries), origin);
  };

  /**
   * Folds after the change that left entries to put back, once the binding has
   * followed it, with no election, grace or threshold, unless a fold came first.
   */
  const refold = () => {
    if (destroyed || toPutBack === null) return;
    if (!compact().compacted) putBackAlone();
  };

  /** Folds after the change at hand, so a fold never lands inside another transaction's observers. */
  const schedule = () => {
    if (!auto || scheduled) return;
    scheduled = true;
    void Promise.resolve().then(run);
  };

  if (refused.length) {
    void Promise.resolve().then(() =>
      refused.forEach(message => host.emitError(refusal(message)))
    );
  }

  /** Folds on its own only once the room has been watched this long, after synced and after each time the others came back into sight. */
  const startGrace = () => {
    if (graceTimer !== null) clearTimeout(graceTimer);
    graceOver = false;
    graceTimer = setTimeout(() => {
      graceTimer = null;
      graceOver = true;
      schedule();
    }, electionGraceMs);
  };

  doc.on('afterTransaction', onAfterTransaction);
  let stopWatching = () => {};
  if (auto && awareness) {
    const room = awareness;
    let smallest = smallestCandidate(room);
    // A candidate that leaves, or one that comes, moves the election, which
    // may then fall to this binding with the log already past the threshold.
    const onAwareness = () => {
      const present = seesOthers(room);
      if (present !== inSight) {
        inSight = present;
        if (present && isSynced) startGrace();
      }
      const next = smallestCandidate(room);
      if (next === smallest) return;
      smallest = next;
      schedule();
    };
    room.on('change', onAwareness);
    stopWatching = () => room.off('change', onAwareness);
  }

  synced?.then(
    () => {
      if (destroyed) return;
      isSynced = true;
      if (!auto) return;
      if (!awareness) {
        graceOver = true;
        schedule();
        return;
      }
      startGrace();
    },
    () => {
      if (destroyed) return;
      // A candidate that never folds would keep every other from folding.
      if (standing) {
        standing = false;
        host.withdraw();
      }
      host.emitError(
        refusal('synced rejected, so the binding never folds the log')
      );
    }
  );

  return {
    get candidate() {
      return standing;
    },
    compact,
    putBack: () => (toPutBack === null ? [] : toPutBack.entries),
    reconcile: snapshot => {
      // A snapshot of another lineage leaves nothing to put back.
      if (toPutBack !== null && toPutBack.lineage !== snapshot.seedId) {
        toPutBack = null;
      }
      if (!held.length || isLast(snapshot)) return;

      const back: LogEntry[] = [];
      for (const fold of held) {
        for (const entry of fold.entries) {
          const covered = entry.seq <= (snapshot.covers[entry.by] ?? 0);
          if (entry.lineage === snapshot.seedId && !covered) {
            back.push(copyJson(entry));
          }
        }
      }
      release();
      if (!back.length) return;
      // Sent apart from a fold, a client online throughout would apply them
      // after a later entry that builds on them, and another compactor could
      // fold them so before this one's fold reached it.
      toPutBack = { lineage: snapshot.seedId, entries: back };
      void Promise.resolve().then(refold);
    },
    confirm: (snapshot, transaction) => {
      if (isLast(snapshot) && !foldTransactions.has(transaction)) release();
    },
    schedule,
    destroy: () => {
      destroyed = true;
      if (graceTimer !== null) clearTimeout(graceTimer);
      putBackAlone();
      release();
      doc.off('afterTransaction', onAfterTransaction);
      stopWatching();
    },
  };
}
