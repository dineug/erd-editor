import { type PlatformPath, posix, win32 } from 'node:path';

import { errnoCode, SessionError, SessionErrorCode } from '@/errors';
import { type McpIo } from '@/io';

/** The extensions the VS Code custom editor opens, which the hub also insists on. */
export const ERD_EXTENSIONS: readonly string[] = [
  'erd',
  'vuerd',
  'erd.json',
  'vuerd.json',
];

/** What a new document gets when its name has no extension at all. */
export const DEFAULT_EXTENSION = '.erd.json';

export function pathsOf(platform: string): PlatformPath {
  return platform === 'win32' ? win32 : posix;
}

export function isErdPath(path: string): boolean {
  const name = path.toLowerCase();
  return ERD_EXTENSIONS.some(extension => name.endsWith(`.${extension}`));
}

/** One key per document: win32 and darwin compare paths case-insensitively, as paths.ts does. */
export function sessionKey(path: string, platform: string): string {
  return platform === 'win32' || platform === 'darwin'
    ? path.toLowerCase()
    : path;
}

/**
 * Resolves symlinks on the longest prefix that exists, so a document about to
 * be created resolves like the hub will resolve it once it does.
 */
export async function realPath(io: McpIo, target: string): Promise<string> {
  const paths = pathsOf(io.platform());
  try {
    return await io.realpath(target);
  } catch (error) {
    const parent = paths.dirname(target);
    if (errnoCode(error) !== 'ENOENT' || parent === target) return target;
    return paths.join(await realPath(io, parent), paths.basename(target));
  }
}

/**
 * The absolute real path of an ERD document an agent named, relative paths
 * against the server's working directory. With create, a name without any
 * extension gets .erd.json; any other non ERD path is refused.
 */
export async function resolveDocumentPath(
  io: McpIo,
  input: string,
  create = false
): Promise<string> {
  const paths = pathsOf(io.platform());
  if (input.trim() === '') {
    throw new SessionError(SessionErrorCode.invalidPath, 'path is empty');
  }

  let absolute = paths.resolve(io.cwd(), input);
  if (!isErdPath(absolute)) {
    if (!create || paths.extname(absolute) !== '') {
      throw new SessionError(
        SessionErrorCode.invalidPath,
        `${absolute} is not an ERD document; use a ${ERD_EXTENSIONS.map(extension => `.${extension}`).join(', ')} file, and ${DEFAULT_EXTENSION} for a new one`
      );
    }
    absolute += DEFAULT_EXTENSION;
  }
  return realPath(io, absolute);
}
