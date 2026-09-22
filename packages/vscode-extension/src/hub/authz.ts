import { type PlatformPath, posix, win32 } from 'node:path';

import {
  assertAuthorized,
  HubErrorCode,
  HubRequestError,
  type Platform,
} from '@dineug/erd-editor-agent-hub';

import { type HubIo } from '@/hub/io';

/** What the lock advertises; paths.ts compares against it, both sides resolved by realpath. */
export type AuthzScope = {
  folders: string[];
  documents: string[];
};

export async function realpathOrSelf(io: HubIo, path: string): Promise<string> {
  try {
    return await io.realpath(path);
  } catch {
    return path;
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'ENOENT';
}

/** No directory entry at all: a dangling link is still one, and a write follows it. */
async function isAbsent(io: HubIo, path: string): Promise<boolean> {
  try {
    await io.lstat(path);
    return false;
  } catch (error) {
    return isNotFound(error);
  }
}

/**
 * Climbs only past entries that do not exist; any other failure leaves the
 * path unresolved. A missing directory followed by .. names nothing, and join
 * would fold the pair away onto a prefix whose links nobody resolved.
 */
async function resolveFrom(
  io: HubIo,
  paths: PlatformPath,
  current: string,
  tail: string[]
): Promise<string | null> {
  let real: string;
  try {
    real = await io.realpath(current);
  } catch (error) {
    const parent = paths.dirname(current);
    if (
      parent === current ||
      !isNotFound(error) ||
      !(await isAbsent(io, current))
    ) {
      return null;
    }
    return resolveFrom(io, paths, parent, [paths.basename(current), ...tail]);
  }
  return tail.includes('..') ? null : paths.join(real, ...tail);
}

/**
 * Resolves symlinks on the longest existing prefix, so a document about to be
 * created still resolves, or null when no safe real path exists. A relative
 * path comes back as given, and paths.ts then matches it against nothing.
 */
export async function resolveRealPath(
  io: HubIo,
  target: string,
  platform: Platform
): Promise<string | null> {
  const paths = platform === 'win32' ? win32 : posix;
  if (!paths.isAbsolute(target)) return target;

  return resolveFrom(io, paths, target, []);
}

/** The real path of target, or a HubRequestError with code outsideWorkspace. */
export async function authorizePath(
  io: HubIo,
  platform: Platform,
  scope: AuthzScope,
  target: string
): Promise<string> {
  const realPath = await resolveRealPath(io, target, platform);
  if (realPath === null) {
    throw new HubRequestError(
      HubErrorCode.outsideWorkspace,
      `${target} has no real path the hub can check, such as a dangling link`
    );
  }
  assertAuthorized(scope.folders, scope.documents, realPath, platform);
  return realPath;
}
