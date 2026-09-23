import {
  LOCK_FILE_MODE,
  lockFilePath,
  type LockRecord,
  readLockDirectory,
  selectHub,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';
import { Context, Effect, FileSystem, Layer } from 'effect';

import { socketFilePaths } from '@/hub/pipePath';
import { HubEnvironment } from '@/hub/services/HubEnvironment';

export type LockFileShape = {
  /** Rewrites this window's lock atomically; false when the write failed. */
  readonly write: (record: LockRecord) => Effect.Effect<boolean>;
  /** Deletes this window's lock and its leftover temp file. */
  readonly remove: Effect.Effect<void>;
  /** Deletes the lock, temp file and socket of every window whose pid is dead. */
  readonly cleanStale: Effect.Effect<void>;
};

export class LockFile extends Context.Service<LockFile, LockFileShape>()(
  'vuerd-vscode/hub/LockFile'
) {}

const tempPath = (lockPath: string): string => `${lockPath}.tmp`;

/** Resolves whether or not the file was there; a missing file is the usual case. */
const removeQuietly = (fs: FileSystem.FileSystem, path: string) =>
  fs.remove(path).pipe(Effect.ignore);

/**
 * Writes the temp file with LOCK_FILE_MODE, then renames it over the lock: a
 * rename keeps the source's mode, so the lock is never readable by others.
 * A leftover temp goes first, since writeFile keeps an existing file's mode.
 */
const writeLock = (
  fs: FileSystem.FileSystem,
  lockPath: string,
  record: LockRecord
) =>
  Effect.gen(function* () {
    const temp = tempPath(lockPath);

    yield* removeQuietly(fs, temp);
    yield* fs.writeFileString(temp, serializeLock(record), {
      mode: LOCK_FILE_MODE,
    });
    yield* fs.rename(temp, lockPath);
  });

const removeLock = (fs: FileSystem.FileSystem, lockPath: string) =>
  Effect.gen(function* () {
    yield* removeQuietly(fs, lockPath);
    yield* removeQuietly(fs, tempPath(lockPath));
  });

export const layer: Layer.Layer<
  LockFile,
  never,
  FileSystem.FileSystem | HubEnvironment
> = Layer.effect(
  LockFile,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const env = yield* HubEnvironment;
    const lockPath = lockFilePath(env.homeDir, env.pid);

    return {
      write: record =>
        writeLock(fs, lockPath, record).pipe(
          Effect.as(true),
          Effect.catch(error =>
            Effect.logWarning(`could not write ${lockPath}`, error).pipe(
              Effect.as(false)
            )
          )
        ),
      remove: removeLock(fs, lockPath).pipe(Effect.ignore),
      cleanStale: Effect.gen(function* () {
        const locks = yield* readLockDirectory(env.homeDir);
        const others = locks.filter(lock => lock.pid !== env.pid);
        const { stale } = selectHub(others, '', env.platform, env.isAlive);

        for (const { pid, reason } of stale) {
          if (reason !== 'dead') continue;

          yield* removeLock(fs, lockFilePath(env.homeDir, pid));
          for (const socket of socketFilePaths(
            env.homeDir,
            env.tmpDir,
            pid,
            env.platform
          )) {
            yield* removeQuietly(fs, socket);
          }
        }
      }).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.ignore),
    };
  })
);
