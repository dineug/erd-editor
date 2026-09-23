import { Array as Arr, Effect, FileSystem, Option } from 'effect';

import {
  lockDirPath,
  lockFilePath,
  lockFilePid,
  type LockRecord,
  parseLock,
} from '@/lock';
import {
  isSamePath,
  longestPrefixIndex,
  type Platform,
  toSegments,
} from '@/paths';

/** A lock file as read from the lock directory, its text left unparsed. */
export type LockFile = { pid: number; raw: string; mtimeMs: number };

/** One lock file's text and mtime, or none when it went away or cannot be read. */
function readLockFile(
  fs: FileSystem.FileSystem,
  homeDir: string,
  pid: number
): Effect.Effect<Option.Option<LockFile>> {
  const path = lockFilePath(homeDir, pid);
  return Effect.all([fs.readFileString(path), fs.stat(path)], {
    concurrency: 2,
  }).pipe(
    Effect.map(([raw, info]) => ({
      pid,
      raw,
      mtimeMs: Option.match(info.mtime, {
        onNone: () => 0,
        onSome: mtime => mtime.getTime(),
      }),
    })),
    Effect.option
  );
}

/**
 * Every lock file of the lock directory under homeDir, unparsed, in listing
 * order. A missing directory reads as none, a name lockFilePid refuses is
 * skipped, and so is a lock deleted or unreadable between listing and reading.
 */
export const readLockDirectory = Effect.fn('readLockDirectory')(function* (
  homeDir: string
) {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs
    .readDirectory(lockDirPath(homeDir))
    .pipe(Effect.orElseSucceed((): string[] => []));
  const pids = names.map(lockFilePid).filter(pid => pid !== null);
  const files = yield* Effect.forEach(pids, pid =>
    readLockFile(fs, homeDir, pid)
  );
  return Arr.getSomes(files);
});

export type LockCandidate = {
  pid: number;
  record: LockRecord;
  mtimeMs: number;
};

export type DiscoveryResult =
  | { kind: 'live'; candidate: LockCandidate }
  | { kind: 'blocked'; candidate: LockCandidate }
  | { kind: 'headless' };

/**
 * A lock that takes no part in the choice. Only a dead one is safe to delete
 * with its socket: a malformed lock of a live pid may be mid-write or from a
 * newer schema, so it is skipped and left in place.
 */
export type StaleLock = { pid: number; reason: 'dead' | 'malformed' };

/** A document match outranks any folder prefix; a deeper folder outranks a shallower one. */
function matchRank(
  record: LockRecord,
  targetPath: string,
  platform: Platform
): number {
  if (record.documents.some(path => isSamePath(path, targetPath, platform))) {
    return Infinity;
  }
  const index = longestPrefixIndex(
    record.workspaceFolders,
    targetPath,
    platform
  );
  return index === -1
    ? -1
    : toSegments(record.workspaceFolders[index], platform).length;
}

type Ranked = { candidate: LockCandidate; rank: number };

function outranks(a: Ranked, b: Ranked): boolean {
  if (a.rank !== b.rank) return a.rank > b.rank;
  if (a.candidate.mtimeMs !== b.candidate.mtimeMs) {
    return a.candidate.mtimeMs > b.candidate.mtimeMs;
  }
  return a.candidate.pid > b.candidate.pid;
}

/**
 * Picks the window that holds targetPath by the authorization rule; ties go to
 * the newest mtimeMs, then the higher pid. A hub-false winner blocks the write
 * and no match at all means headless. targetPath is normalized like paths.ts.
 */
export function selectHub(
  locks: LockFile[],
  targetPath: string,
  platform: Platform,
  isAlive: (pid: number) => boolean
): { selected: DiscoveryResult; stale: StaleLock[] } {
  const stale: StaleLock[] = [];
  let best: Ranked | null = null;

  for (const { pid, raw, mtimeMs } of locks) {
    if (!isAlive(pid)) {
      stale.push({ pid, reason: 'dead' });
      continue;
    }
    const record = parseLock(raw);
    if (!record) {
      stale.push({ pid, reason: 'malformed' });
      continue;
    }

    const rank = matchRank(record, targetPath, platform);
    const ranked: Ranked = { candidate: { pid, record, mtimeMs }, rank };
    if (rank >= 0 && (!best || outranks(ranked, best))) best = ranked;
  }

  const selected: DiscoveryResult = !best
    ? { kind: 'headless' }
    : {
        kind: best.candidate.record.hub ? 'live' : 'blocked',
        candidate: best.candidate,
      };

  return { selected, stale };
}
