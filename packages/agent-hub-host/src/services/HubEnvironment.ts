import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';

import { type Platform } from '@dineug/erd-editor-agent-hub';
import { Context, Effect, Layer, Schema } from 'effect';

/**
 * Why a directory entry could not be examined. NotFound means no entry at all;
 * every other errno folds into Other, which authz treats as unresolvable.
 */
export class HubEnvError extends Schema.TaggedError<HubEnvError>()(
  'HubEnvError',
  {
    reason: Schema.Literals(['NotFound', 'Other']),
    path: Schema.String,
    message: Schema.String,
  }
) {}

export type HubEnvironmentShape = {
  readonly homeDir: string;
  readonly tmpDir: string;
  readonly platform: Platform;
  readonly pid: number;
  /** The host version the lock advertises, its extension's or its plugin's. */
  readonly version: string;
  readonly randomToken: Effect.Effect<string>;
  readonly isAlive: (pid: number) => boolean;
  /**
   * Succeeds when an entry exists, a dangling symlink included, and fails with
   * NotFound when there is none; the last link is never followed.
   */
  readonly lstat: (path: string) => Effect.Effect<void, HubEnvError>;
  /**
   * Deletes a file before it returns and never throws, for a host that goes
   * down without awaiting the hub's close. A file already gone is no error.
   */
  readonly removeFileSync: (path: string) => void;
};

/**
 * What the hub knows about the machine it runs on. PlatformError folds EINVAL,
 * EPERM, EIO and every other errno it does not map into Unknown, so lstat keeps
 * its raw code here rather than lose the difference authz turns on.
 */
export class HubEnvironment extends Context.Service<
  HubEnvironment,
  HubEnvironmentShape
>()('@dineug/erd-editor-agent-hub-host/HubEnvironment') {}

function errnoOf(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code;
}

/**
 * Signal 0 checks existence only. EPERM is an elevated window of this user on
 * Windows, so it is alive there; on POSIX it is another user's process, which
 * a lock in this user's home never names, so a reused pid still counts dead.
 */
export function isAlive(
  pid: number,
  platform: Platform = process.platform as Platform
): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return platform === 'win32' && errnoOf(error) === 'EPERM';
  }
}

function removeFileSync(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Missing, or out of reach: nothing is left to do while the host goes down.
  }
}

export function makeNodeEnvironment(version: string): HubEnvironmentShape {
  const platform = process.platform as Platform;
  return {
    homeDir: homedir(),
    tmpDir: tmpdir(),
    platform,
    pid: process.pid,
    version,
    randomToken: Effect.sync(() => randomUUID()),
    isAlive: pid => isAlive(pid, platform),
    lstat: path =>
      Effect.tryPromise({
        try: () => lstat(path),
        catch: error =>
          new HubEnvError({
            reason: errnoOf(error) === 'ENOENT' ? 'NotFound' : 'Other',
            path,
            message: String(error),
          }),
      }).pipe(Effect.asVoid),
    removeFileSync,
  };
}

/** Reads the machine once, when the hub's runtime builds this layer. */
export const layer = (version: string): Layer.Layer<HubEnvironment> =>
  Layer.sync(HubEnvironment, () => makeNodeEnvironment(version));
