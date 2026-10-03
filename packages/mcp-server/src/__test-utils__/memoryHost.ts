import {
  type HubNotification,
  lockDirPath,
  lockFilePath,
  type LockRecord,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';
import { Effect, Layer } from 'effect';

import {
  createMemoryFs,
  fsError,
  type MemoryFs,
} from '@/__test-utils__/memoryFs';
import {
  memoryConnect,
  type ServerSocket,
} from '@/__test-utils__/memorySocket';
import * as HubConnector from '@/hub/client';
import * as HubDiscovery from '@/hub/discovery';
import {
  FileAccess,
  type FileAccessShape,
  FileStats,
  statsFromFileSystem,
} from '@/io/fileSystem';
import type { ConnectPipe } from '@/io/netSocket';
import * as ProcessInfo from '@/io/process';
import { StderrLogger } from '@/logger';
import type { Platform } from '@/server';

export type MemoryHostOptions = {
  home?: string;
  cwd?: string;
  platform?: string;
};

/** What a spec runs directly on the host: the platform and discovery over it. */
export type HostServices = Platform | HubDiscovery.HubDiscovery;

export type MemoryHost = MemoryFs & {
  readonly home: string;
  readonly cwd: string;
  readonly platform: string;
  readonly alive: Set<number>;
  /** The hubs listening, by pipe; delete one to make its lock point nowhere. */
  readonly servers: Map<string, (socket: ServerSocket) => void>;
  /** How the server reaches a pipe; replace it to make a connection fail. */
  connect: ConnectPipe;
  /**
   * FileAccess, each member replaceable: every rename keeps access, and an
   * in-place write replaces a file's text, mode and all kept, with no rename.
   */
  access: {
    keepsAccess: FileAccessShape['keepsAccess'];
    writeInPlace: FileAccessShape['writeInPlace'];
  };
  /** What FileStats.identity answers, by spelling; give two spellings one to make them one file. */
  readonly identities: Map<string, string>;
  writeLock: (pid: number, record: LockRecord, mtimeMs?: number) => void;
  removeLock: (pid: number) => void;
  /** Settles once a session took a hub notification that matches, its handler run. */
  taken: (match: (notification: HubNotification) => boolean) => Promise<void>;
  /** Files, paths, the process and hub connections, all in memory. */
  readonly layer: Layer.Layer<Platform>;
  /** Runs an effect on this host, logging to stderr as the server does. */
  run: <A, E>(effect: Effect.Effect<A, E, HostServices>) => Promise<A>;
};

/**
 * A machine in memory for the server to run on: a POSIX file system with the
 * lock directory and the working directory made, pids that live only when a
 * spec says so, and pipes a fake hub listens on.
 */
export function createMemoryHost(options: MemoryHostOptions = {}): MemoryHost {
  const home = options.home ?? '/home/agent';
  const cwd = options.cwd ?? '/work';
  const platform = options.platform ?? 'linux';
  const alive = new Set<number>();
  const servers = new Map<string, (socket: ServerSocket) => void>();
  const fs = createMemoryFs();
  fs.mkdir(lockDirPath(home));
  fs.mkdir(cwd);
  const takenWaiters = new Set<{
    match: (notification: HubNotification) => boolean;
    resolve: () => void;
  }>();

  const access: MemoryHost['access'] = {
    keepsAccess: () => Effect.succeed(true),
    writeInPlace: (path, text) =>
      Effect.suspend(() => {
        if (!fs.files.has(path)) {
          return Effect.fail(fsError('NotFound', 'open', path));
        }
        fs.writes.push(path);
        fs.put(path, text);
        const { mtimeMs, mode } = fs.files.get(path)!;
        return Effect.succeed({ size: text.length, mtimeMs, mode });
      }),
  };

  const host = Object.assign(fs, {
    home,
    cwd,
    platform,
    alive,
    servers,
    connect: memoryConnect(servers),
    access,
    identities: new Map<string, string>(),
    writeLock: (pid: number, record: LockRecord, mtimeMs?: number) => {
      fs.put(lockFilePath(home, pid), serializeLock(record), 0o600);
      if (mtimeMs !== undefined)
        fs.files.get(lockFilePath(home, pid))!.mtimeMs = mtimeMs;
    },
    removeLock: (pid: number) => {
      fs.files.delete(lockFilePath(home, pid));
    },
  }) as MemoryHost;

  const connector = HubConnector.make(pipe => host.connect(pipe));
  /**
   * Connects over the pipes; once a session's handler took a notification,
   * every waiter of taken that it matches settles.
   */
  const connect: HubConnector.HubConnectorShape['connect'] = (
    candidate,
    options
  ) =>
    connector.connect(candidate, {
      ...options,
      onNotification: notification => {
        try {
          options.onNotification?.(notification);
        } finally {
          for (const waiter of Array.from(takenWaiters)) {
            if (waiter.match(notification)) {
              takenWaiters.delete(waiter);
              waiter.resolve();
            }
          }
        }
      },
    });

  const platformLayer: Layer.Layer<Platform> = Layer.mergeAll(
    fs.layer,
    Layer.effect(
      FileStats,
      Effect.gen(function* () {
        const { stat } = yield* FileStats;
        return FileStats.of({
          stat,
          identity: path =>
            Effect.sync(() => host.identities.get(path) ?? null),
        });
      })
    ).pipe(Layer.provide(statsFromFileSystem), Layer.provide(fs.layer)),
    Layer.succeed(
      FileAccess,
      FileAccess.of({
        keepsAccess: (temp, path) => host.access.keepsAccess(temp, path),
        writeInPlace: (path, text) => host.access.writeInPlace(path, text),
      })
    ),
    ProcessInfo.layerTest({
      cwd,
      homeDir: home,
      platform,
      isAlive: pid => alive.has(pid),
    }),
    Layer.succeed(HubConnector.HubConnector, { connect })
  );

  const services = HubDiscovery.layer.pipe(
    Layer.provideMerge(platformLayer),
    Layer.provideMerge(StderrLogger)
  );

  return Object.assign(host, {
    taken: (match: (notification: HubNotification) => boolean) =>
      new Promise<void>(resolve => {
        takenWaiters.add({ match, resolve });
      }),
    layer: platformLayer,
    run: <A, E>(effect: Effect.Effect<A, E, HostServices>) =>
      Effect.runPromise(Effect.provide(effect, services)),
  });
}
