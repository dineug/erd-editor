import {
  type DiscoveryResult,
  lockFilePath,
  pipePath,
  readLockDirectory,
  selectHub,
} from '@dineug/erd-editor-agent-hub';
import { Context, Effect, FileSystem, Layer } from 'effect';

import { ProcessInfo } from '@/io/process';

export type HubDiscoveryShape = {
  /**
   * Picks the window that holds targetPath, a real absolute path. Run before
   * every write, so a hub that appeared or went away since the last call is
   * seen. Dead windows' locks are deleted; a malformed live one is left alone.
   */
  readonly discover: (targetPath: string) => Effect.Effect<DiscoveryResult>;
};

export class HubDiscovery extends Context.Service<
  HubDiscovery,
  HubDiscoveryShape
>()('@dineug/erd-editor-mcp/HubDiscovery') {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { homeDir, platform, isAlive } = yield* ProcessInfo;

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

  const discover = Effect.fn('HubDiscovery.discover')(function* (
    targetPath: string
  ) {
    const { selected, stale } = yield* readLockDirectory(homeDir).pipe(
      Effect.flatMap(locks =>
        selectHub(locks, targetPath, platform, pid => isAlive(pid))
      ),
      Effect.provideService(FileSystem.FileSystem, fs)
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
    return selected;
  });

  return HubDiscovery.of({ discover });
});

/** Discovery over the file system and process a layer gives. */
export const layer: Layer.Layer<
  HubDiscovery,
  never,
  FileSystem.FileSystem | ProcessInfo
> = Layer.effect(HubDiscovery, make);
