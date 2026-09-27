import { randomUUID } from 'node:crypto';
import { getPriority, homedir } from 'node:os';

import type { Platform } from '@dineug/erd-editor-agent-hub';
import { Context, Effect, Layer } from 'effect';

export type ProcessInfoShape = {
  /** The working directory relative document paths resolve against. */
  readonly cwd: string;
  /** Where the lock directory of every editor window on this machine lives. */
  readonly homeDir: string;
  readonly platform: Platform;
  /** A fresh id, for a temp file name. */
  readonly randomId: Effect.Effect<string>;
  readonly isAlive: (pid: number) => boolean;
};

/** What the server knows about the process it runs in, fixed when the layer is built. */
export class ProcessInfo extends Context.Service<
  ProcessInfo,
  ProcessInfoShape
>()('@dineug/erd-editor-mcp/ProcessInfo') {}

/**
 * Signal 0, where a refusal is another user's process, so dead. On Windows a
 * refusal asks for the least query right, which this user holds on its every
 * process, an elevated window too, and not on SYSTEM's, a service's or others'.
 */
export function isAlive(
  pid: number,
  platform: Platform = process.platform,
  query: (pid: number) => number = getPriority
): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      platform !== 'win32' ||
      (error as { code?: unknown } | null)?.code !== 'EPERM'
    ) {
      return false;
    }
  }
  try {
    query(pid);
    return true;
  } catch (error) {
    // libuv's getpriority opens the process for that right alone. A refusal or
    // no such process is dead; any other failure keeps the lock, never swept.
    const code = (error as { info?: { code?: unknown } } | null)?.info?.code;
    return code !== 'EPERM' && code !== 'ESRCH';
  }
}

export const layer: Layer.Layer<ProcessInfo> = Layer.sync(ProcessInfo, () => ({
  cwd: process.cwd(),
  homeDir: homedir(),
  platform: process.platform,
  randomId: Effect.sync(() => randomUUID()),
  isAlive,
}));

/**
 * A process for the specs: working directory /work, home /home/agent, linux,
 * ids counted from id1 per layer, and no pid alive unless a spec says so.
 */
export const layerTest = (
  overrides: Partial<ProcessInfoShape> = {}
): Layer.Layer<ProcessInfo> =>
  Layer.sync(ProcessInfo, () => {
    let ids = 0;
    return {
      cwd: '/work',
      homeDir: '/home/agent',
      platform: 'linux',
      randomId: Effect.sync(() => `id${++ids}`),
      isAlive: () => false,
      ...overrides,
    };
  });
