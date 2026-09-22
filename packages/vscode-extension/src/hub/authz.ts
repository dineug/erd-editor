import { type PlatformPath, posix, win32 } from 'node:path';

import {
  assertAuthorized,
  HubErrorCode,
  HubRequestError,
  type Platform,
} from '@dineug/erd-editor-agent-hub';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import type * as PlatformError from 'effect/PlatformError';

import { HubEnvironment } from '@/hub/services/HubEnvironment';

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

/** The real path of target, or a HubRequestError with code outsideWorkspace. */
export const authorizePath = Effect.fn('authorizePath')(function* (
  platform: Platform,
  scope: AuthzScope,
  target: string
) {
  const realPath = yield* resolveRealPath(target, platform);
  if (realPath === null) {
    return yield* Effect.fail(
      new HubRequestError({
        code: HubErrorCode.outsideWorkspace,
        message: `${target} has no real path the hub can check, such as a dangling link`,
      })
    );
  }
  return yield* Effect.try({
    try: () => {
      assertAuthorized(scope.folders, scope.documents, realPath, platform);
      return realPath;
    },
    catch: error => error as HubRequestError,
  });
});
