import {
  lockDirPath,
  lockFilePath,
  type LockRecord,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { createMemoryFs, type MemoryFs } from '@/__test-utils__/memoryFs';
import {
  memoryConnect,
  type ServerSocket,
} from '@/__test-utils__/memorySocket';
import * as HubConnector from '@/hub/client';
import * as HubDiscovery from '@/hub/discovery';
import { statsFromFileSystem } from '@/io/fileSystem';
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
  writeLock: (pid: number, record: LockRecord, mtimeMs?: number) => void;
  removeLock: (pid: number) => void;
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

  const host = Object.assign(fs, {
    home,
    cwd,
    platform,
    alive,
    servers,
    connect: memoryConnect(servers),
    writeLock: (pid: number, record: LockRecord, mtimeMs?: number) => {
      fs.put(lockFilePath(home, pid), serializeLock(record), 0o600);
      if (mtimeMs !== undefined)
        fs.files.get(lockFilePath(home, pid))!.mtimeMs = mtimeMs;
    },
    removeLock: (pid: number) => {
      fs.files.delete(lockFilePath(home, pid));
    },
  }) as MemoryHost;

  const platformLayer: Layer.Layer<Platform> = Layer.mergeAll(
    fs.layer,
    statsFromFileSystem.pipe(Layer.provide(fs.layer)),
    ProcessInfo.layerTest({
      cwd,
      homeDir: home,
      platform,
      isAlive: pid => alive.has(pid),
    }),
    HubConnector.layerWith(pipe => host.connect(pipe))
  );

  const services = HubDiscovery.layer.pipe(
    Layer.provideMerge(platformLayer),
    Layer.provideMerge(StderrLogger)
  );

  return Object.assign(host, {
    layer: platformLayer,
    run: <A, E>(effect: Effect.Effect<A, E, HostServices>) =>
      Effect.runPromise(Effect.provide(effect, services)),
  });
}
