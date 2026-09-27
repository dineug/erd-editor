import {
  type LockCandidate,
  type LockFile,
  lockFilePath,
  parseLock,
  pipePath,
  readLockDirectory,
  selectHub,
  type StaleLock,
} from '@dineug/erd-editor-agent-hub';
import { Context, Effect, FileSystem, Layer } from 'effect';

import { findAlias } from '@/hub/alias';
import { FileStats } from '@/io/fileSystem';
import { ProcessInfo } from '@/io/process';

/**
 * What discovery found. alias is set when no lock names the target as it is
 * spelled but a window holds it the other way, through a share or a drive.
 */
export type Resolution =
  | { kind: 'live' | 'blocked'; candidate: LockCandidate; alias?: string }
  | { kind: 'headless' };

export type HubDiscoveryShape = {
  /**
   * Picks the window that holds targetPath, a real absolute path. Run before
   * every write, so a hub that appeared or went away since the last call is
   * seen. Dead windows' locks are deleted; a malformed live one is left alone.
   */
  readonly discover: (targetPath: string) => Effect.Effect<Resolution>;
};

export class HubDiscovery extends Context.Service<
  HubDiscovery,
  HubDiscoveryShape
>()('@dineug/erd-editor-mcp/HubDiscovery') {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const stats = yield* FileStats;
  const { homeDir, platform, isAlive } = yield* ProcessInfo;
  /** The identities of the paths each lock version lists, so a share is asked once per version. */
  const listedIdentities = new Map<string, Map<string, string | null>>();

  const removeQuietly = (path: string) => fs.remove(path).pipe(Effect.ignore);

  /** A dead window's lock, its temp file and the socket beside it; a named pipe is no file. */
  const removeDeadLock = Effect.fn('HubDiscovery.removeDeadLock')(function* (
    pid: number
  ) {
    const lock = lockFilePath(homeDir, pid);
    yield* removeQuietly(lock);
    yield* removeQuietly(`${lock}.tmp`);
    if (platform !== 'win32') {
      yield* removeQuietly(pipePath(homeDir, pid, platform));
    }
  });

  const versionOf = ({ pid, mtimeMs }: { pid: number; mtimeMs: number }) =>
    `${pid}:${mtimeMs}`;

  const listedIdentityOf = (candidate: LockCandidate, path: string) =>
    Effect.suspend(() => {
      const version = versionOf(candidate);
      const known =
        listedIdentities.get(version) ?? new Map<string, string | null>();
      listedIdentities.set(version, known);
      return known.has(path)
        ? Effect.succeed(known.get(path) ?? null)
        : stats
            .identity(path)
            .pipe(
              Effect.tap(identity =>
                Effect.sync(() => known.set(path, identity))
              )
            );
    });

  /** The window holding targetPath the other way, among the locks selectHub kept. */
  const aliasOf = Effect.fn('HubDiscovery.aliasOf')(function* (
    targetPath: string,
    locks: LockFile[],
    stale: StaleLock[]
  ) {
    const skipped = new Set(stale.map(({ pid }) => pid));
    const candidates = locks.flatMap(({ pid, raw, mtimeMs }) => {
      const record = skipped.has(pid) ? null : parseLock(raw);
      return record ? [{ pid, record, mtimeMs }] : [];
    });
    const versions = new Set(candidates.map(versionOf));
    for (const version of listedIdentities.keys()) {
      if (!versions.has(version)) listedIdentities.delete(version);
    }

    const alias = yield* findAlias(
      targetPath,
      candidates,
      stats.identity,
      listedIdentityOf
    );
    return alias
      ? ({
          kind: alias.candidate.record.hub ? 'live' : 'blocked',
          candidate: alias.candidate,
          alias: alias.spelled,
        } satisfies Resolution)
      : null;
  });

  const discover = Effect.fn('HubDiscovery.discover')(function* (
    targetPath: string
  ) {
    const locks = yield* readLockDirectory(homeDir).pipe(
      Effect.provideService(FileSystem.FileSystem, fs)
    );
    const { selected, stale } = yield* selectHub(
      locks,
      targetPath,
      platform,
      pid => isAlive(pid)
    );

    for (const { pid, reason } of stale) {
      if (reason === 'dead') {
        yield* removeDeadLock(pid);
      } else {
        yield* Effect.logWarning(
          `skipped the lock of pid ${pid}: it does not parse`
        );
      }
    }
    // Only Windows reaches one file both by a drive path and by a share path.
    if (selected.kind !== 'headless' || platform !== 'win32') return selected;
    return (yield* aliasOf(targetPath, locks, stale)) ?? selected;
  });

  return HubDiscovery.of({ discover });
});

/** Discovery over the file system, stat and process a layer gives. */
export const layer: Layer.Layer<
  HubDiscovery,
  never,
  FileSystem.FileSystem | FileStats | ProcessInfo
> = Layer.effect(HubDiscovery, make);
