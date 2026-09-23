import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

import type { Platform } from '@dineug/erd-editor-agent-hub';
import { Context, Effect, Layer } from 'effect';

export type ProcessInfoShape = {
  /** The working directory relative document paths resolve against. */
  readonly cwd: string;
  /** Where the lock directory of every VS Code window on this machine lives. */
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

/** Signal 0 checks existence only; EPERM means another user's process, never this user's window. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
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
