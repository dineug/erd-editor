import type * as Y from 'yjs';

import type { Watermarks } from '@/log';
import type { Registers } from '@/port';

export const SNAPSHOT_KEY = 'erd:snapshot';

/** The layout of the Y.Doc this package writes; a binding refuses a snapshot of another. */
export const ERD_YJS_FORMAT = 1;

/** The log folded into one value, as a seed or a compaction wrote it. */
export type Snapshot = {
  format: number;
  /** How many compactions the lineage has had; a seed writes 0. */
  generation: number;
  /** The lineage: drawn by the seed and kept by every compaction of it. */
  seedId: string;
  /** The binding that compacted, null for a seed. */
  compactorId: string | null;
  runtimeValue: string;
  lww: Registers;
  version: number;
  /** Per writer, the seq up to which the snapshot holds its entries. */
  covers: Watermarks;
};

export type SnapshotRead =
  | { state: 'none' }
  | { state: 'unsupported'; format: unknown }
  | { state: 'ready'; snapshot: Snapshot };

const FIELDS = [
  'format',
  'generation',
  'seedId',
  'compactorId',
  'runtimeValue',
  'lww',
  'version',
  'covers',
] as const;

export const getSnapshotMap = (doc: Y.Doc): Y.Map<unknown> =>
  doc.getMap<unknown>(SNAPSHOT_KEY);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWatermarks = (value: unknown): value is Watermarks =>
  isRecord(value) &&
  Object.keys(value).every(key => Number.isInteger(value[key]));

/**
 * Reads the snapshot a seed or a compaction wrote, every field in one write.
 * A format other than this package's, or a field of another shape, is unsupported.
 */
export function readSnapshot(map: Y.Map<unknown>): SnapshotRead {
  if (map.size === 0) return { state: 'none' };

  const value: Record<string, unknown> = {};
  for (const field of FIELDS) value[field] = map.get(field);

  const shaped =
    value.format === ERD_YJS_FORMAT &&
    Number.isInteger(value.generation) &&
    typeof value.seedId === 'string' &&
    (value.compactorId === null || typeof value.compactorId === 'string') &&
    typeof value.runtimeValue === 'string' &&
    isRecord(value.lww) &&
    typeof value.version === 'number' &&
    isWatermarks(value.covers);

  return shaped
    ? { state: 'ready', snapshot: value as Snapshot }
    : { state: 'unsupported', format: value.format };
}

/** Writes every field, so two snapshots written at once resolve to one of them whole. */
export function writeSnapshot(map: Y.Map<unknown>, snapshot: Snapshot) {
  for (const field of FIELDS) map.set(field, snapshot[field]);
}

/** Whether the snapshot holds an entry the binding has not applied, which only a rejoin brings in. */
export function needsRejoin(covers: Watermarks, applied: Watermarks): boolean {
  return Object.keys(covers).some(by => covers[by] > (applied[by] ?? 0));
}

export type LineageCheck = 'same' | 'seedLost' | 'snapshot';

/**
 * How a snapshot stands to the lineage a binding joined: the same one, or
 * another, which the binding lost to if it seeded the one it joined.
 */
export function checkLineage(
  seedId: string,
  joined: string | null,
  seeded: string | null
): LineageCheck {
  if (seedId === joined) return 'same';
  return joined !== null && joined === seeded ? 'seedLost' : 'snapshot';
}
