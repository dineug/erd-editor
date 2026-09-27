import { type PlatformPath, posix, win32 } from 'node:path';

import {
  authorize,
  HubErrorCode,
  HubRequestError,
  type Platform,
  unsafeSegment,
} from '@dineug/erd-editor-agent-hub';
import type { PlatformError } from 'effect';
import { Effect, FileSystem } from 'effect';

import { HubEnvironment } from '@/services/HubEnvironment';

/** What the lock advertises; paths.ts compares against it, both sides resolved by realpath. */
export type AuthzScope = {
  folders: string[];
  documents: string[];
};

export const realpathOrSelf = Effect.fn('realpathOrSelf')(function* (
  path: string
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.realPath(path).pipe(Effect.orElseSucceed(() => path));
});

function isNotFound(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === 'NotFound';
}

/** No directory entry at all: a dangling link is still one, and a write follows it. */
const isAbsent = (path: string) =>
  Effect.gen(function* () {
    const env = yield* HubEnvironment;
    return yield* env.lstat(path).pipe(
      Effect.as(false),
      Effect.catch(error => Effect.succeed(error.reason === 'NotFound'))
    );
  });

/**
 * Climbs only past entries that do not exist; any other failure leaves the
 * path unresolved. A missing directory followed by .. names nothing, and join
 * would fold the pair away onto a prefix whose links nobody resolved.
 */
const resolveFrom = (
  paths: PlatformPath,
  current: string,
  tail: string[]
): Effect.Effect<
  string | null,
  never,
  FileSystem.FileSystem | HubEnvironment
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const resolved = yield* fs.realPath(current).pipe(Effect.result);

    if (resolved._tag === 'Success') {
      return tail.includes('..') ? null : paths.join(resolved.success, ...tail);
    }
    const parent = paths.dirname(current);
    if (parent === current || !isNotFound(resolved.failure)) return null;
    if (!(yield* isAbsent(current))) return null;
    return yield* resolveFrom(paths, parent, [
      paths.basename(current),
      ...tail,
    ]);
  });

/**
 * Resolves symlinks on the longest existing prefix, so a document about to be
 * created still resolves, or null when no safe real path exists. A relative
 * path comes back as given, and paths.ts then matches it against nothing.
 */
export const resolveRealPath = Effect.fn('resolveRealPath')(function* (
  target: string,
  platform: Platform
) {
  const paths = platform === 'win32' ? win32 : posix;
  if (!paths.isAbsolute(target)) return target;

  return yield* resolveFrom(paths, target, []);
});

/** Refuses a path holding a name Windows does not store as written, with badRequest. */
const refuseUnsafeName = (path: string, platform: Platform) =>
  Effect.suspend(() => {
    const segment = unsafeSegment(path, platform);
    return segment === null
      ? Effect.void
      : Effect.fail(
          new HubRequestError({
            code: HubErrorCode.badRequest,
            message: `${path} holds ${JSON.stringify(segment)}, which Windows does not store as written: a colon names a stream of another file, NUL, CON, COM1 and the like are devices, and a trailing dot or space is dropped`,
          })
        );
  });

/**
 * The real path of target, or a HubRequestError: badRequest for a name Windows
 * does not store as written, checked before the climb touches the disk and on
 * the real path, and outsideWorkspace for a path the scope does not hold.
 */
export const authorizePath = Effect.fn('authorizePath')(function* (
  platform: Platform,
  scope: AuthzScope,
  target: string
) {
  yield* refuseUnsafeName(target, platform);
  const realPath = yield* resolveRealPath(target, platform);
  if (realPath === null) {
    return yield* Effect.fail(
      new HubRequestError({
        code: HubErrorCode.outsideWorkspace,
        message: `${target} has no real path the hub can check, such as a dangling link`,
      })
    );
  }
  yield* refuseUnsafeName(realPath, platform);
  yield* authorize(scope.folders, scope.documents, realPath, platform);
  return realPath;
});
