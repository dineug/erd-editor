import type * as Y from 'yjs';

import { copyJson, isRecord } from '@/json';
import type { PortAction } from '@/port';

export const LOG_KEY = 'erd:log';

/** One batch of document changes as its writer sent it, its versions, tags and meta untouched. */
export type LogEntry = {
  /** The binding that wrote it: an id each binding draws for itself. */
  by: string;
  /** Its place among that binding's entries, from 1 with no gap. */
  seq: number;
  /** The seedId of the snapshot its writer had joined. */
  lineage: string;
  actions: PortAction[];
};

/** Per writer, the highest seq up to which every entry has been applied. */
export type Watermarks = Record<string, number>;

export const getLog = (doc: Y.Doc): Y.Array<unknown> =>
  doc.getArray<unknown>(LOG_KEY);

export function isLogEntry(value: unknown): value is LogEntry {
  return (
    isRecord(value) &&
    typeof value.by === 'string' &&
    typeof value.lineage === 'string' &&
    typeof value.seq === 'number' &&
    Number.isInteger(value.seq) &&
    value.seq > 0 &&
    Array.isArray(value.actions)
  );
}

/** The values a change of the log inserted, in the order the log holds them. */
export function insertedOf(event: Y.YArrayEvent<unknown>): unknown[] {
  const inserted: unknown[] = [];
  for (const { insert } of event.changes.delta) {
    if (!Array.isArray(insert)) continue;
    for (const value of insert) inserted.push(value);
  }
  return inserted;
}

/**
 * Deletes every value drop names in one pass from the back, so each index
 * still points where it did, and returns the entries it took out in log order.
 */
export function removeEntries(
  log: Y.Array<unknown>,
  drop: (value: unknown) => boolean
): unknown[] {
  const values = log.toArray();
  const runs: unknown[][] = [];
  let end = values.length;

  while (end > 0) {
    if (!drop(values[end - 1])) {
      end--;
      continue;
    }
    let start = end - 1;
    while (start > 0 && drop(values[start - 1])) start--;
    log.delete(start, end - start);
    runs.push(values.slice(start, end));
    end = start;
  }
  const removed: unknown[] = [];
  for (const run of runs.reverse()) {
    for (const value of run) removed.push(value);
  }
  return removed;
}

export type LogWriter = {
  readonly bindingId: string;
  readonly seq: number;
  /** Pushes one entry under the writer's next seq, tagged with the origin its observers skip. */
  write: (lineage: string, actions: PortAction[]) => LogEntry;
  /** Draws a new binding id and starts its seq again from 1, for a binding that moved to another lineage. */
  restart: () => void;
};

export function createLogWriter(
  doc: Y.Doc,
  origin: symbol,
  createId: () => string
): LogWriter {
  const log = getLog(doc);
  let bindingId = createId();
  let seq = 0;

  return {
    get bindingId() {
      return bindingId;
    },
    get seq() {
      return seq;
    },
    write: (lineage, actions) => {
      const entry: LogEntry = {
        by: bindingId,
        seq: seq + 1,
        lineage,
        actions: copyJson(actions),
      };
      doc.transact(() => log.push([entry]), origin);
      seq = entry.seq;
      return entry;
    },
    restart: () => {
      bindingId = createId();
      seq = 0;
    },
  };
}

export type LogReader = {
  readonly applied: Readonly<Watermarks>;
  /** Starts again from the watermarks a snapshot covers, forgetting every entry held back. */
  reset: (covers: Watermarks) => void;
  /**
   * Applies, in the order given, each entry of the lineage that comes next for
   * its writer, holds a later one until its gap fills and skips one already in.
   */
  offer: (values: ReadonlyArray<unknown>, lineage: string) => void;
  /**
   * Records an entry this binding wrote, which its store already holds. One
   * past a gap stays apart until the gap fills, so an entry put back into the
   * gap still applies and the watermark then moves over this one unapplied.
   */
  note: (by: string, seq: number) => void;
};

export function createLogReader(apply: (entry: LogEntry) => void): LogReader {
  let applied: Watermarks = {};
  let held = new Map<string, Map<number, LogEntry>>();
  // Per writer, the seqs past its gap this binding wrote, held by its store already.
  let written = new Map<string, Set<number>>();

  const watermarkOf = (by: string) => applied[by] ?? 0;

  /** Moves the writer's watermark over each seq that now comes next, applying the held ones. */
  const advance = (by: string) => {
    const waiting = held.get(by);
    const own = written.get(by);
    for (;;) {
      const next = watermarkOf(by) + 1;
      if (own?.delete(next)) {
        applied[by] = next;
        continue;
      }
      const entry = waiting?.get(next);
      if (!waiting || !entry) break;
      waiting.delete(next);
      apply(entry);
      applied[by] = next;
    }
    if (waiting && waiting.size === 0) held.delete(by);
    if (own && own.size === 0) written.delete(by);
  };

  return {
    get applied() {
      return applied;
    },
    reset: covers => {
      applied = { ...covers };
      held = new Map();
      written = new Map();
    },
    offer: (values, lineage) => {
      for (const value of values) {
        if (!isLogEntry(value) || value.lineage !== lineage) continue;

        const watermark = watermarkOf(value.by);
        if (value.seq <= watermark) continue;
        if (written.get(value.by)?.has(value.seq)) continue;
        if (value.seq === watermark + 1) {
          apply(value);
          applied[value.by] = value.seq;
          advance(value.by);
          continue;
        }

        const waiting = held.get(value.by) ?? new Map<number, LogEntry>();
        waiting.set(value.seq, value);
        held.set(value.by, waiting);
      }
    },
    note: (by, seq) => {
      const watermark = watermarkOf(by);
      if (seq <= watermark) return;
      if (seq === watermark + 1) {
        applied[by] = seq;
        advance(by);
        return;
      }
      const own = written.get(by) ?? new Set<number>();
      own.add(seq);
      written.set(by, own);
    },
  };
}
