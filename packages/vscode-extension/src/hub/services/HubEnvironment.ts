import { randomUUID } from 'node:crypto';
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
  /** The extension version the lock advertises. */
  readonly version: string;
  readonly randomToken: Effect.Effect<string>;
  readonly isAlive: (pid: number) => boolean;
  /**
   * Succeeds when an entry exists, a dangling symlink included, and fails with
   * NotFound when there is none; the last link is never followed.
   */
  readonly lstat: (path: string) => Effect.Effect<void, HubEnvError>;
};

/**
 * What the hub knows about the machine it runs on. PlatformError folds EINVAL,
 * EPERM, EIO and every other errno it does not map into Unknown, so lstat keeps
 * its raw code here rather than lose the difference authz turns on.
 */
export class HubEnvironment extends Context.Service<
  HubEnvironment,
  HubEnvironmentShape
>()('vuerd-vscode/hub/HubEnvironment') {}

function errnoOf(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code;
}

/** Signal 0 checks existence only; EPERM means another user's process, never this user's window. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function makeNodeEnvironment(version: string): HubEnvironmentShape {
  return {
    homeDir: homedir(),
    tmpDir: tmpdir(),
    platform: process.platform as Platform,
    pid: process.pid,
    version,
    randomToken: Effect.sync(() => randomUUID()),
    isAlive,
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
  };
}

/** Reads the machine once, when the hub's runtime builds this layer. */
export const layer = (version: string): Layer.Layer<HubEnvironment> =>
  Layer.sync(HubEnvironment, () => makeNodeEnvironment(version));
