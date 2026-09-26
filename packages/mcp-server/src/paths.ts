import { Effect, FileSystem, Path } from 'effect';

import { SessionError, SessionErrorCode } from '@/errors';
import { ProcessInfo } from '@/io/process';

/** The extensions the ERD editors of VS Code and Obsidian open, which their hubs also insist on. */
export const ERD_EXTENSIONS: readonly string[] = [
  'erd',
  'vuerd',
  'erd.json',
  'vuerd.json',
];

/** What a new document gets when its name has no extension at all. */
export const DEFAULT_EXTENSION = '.erd.json';

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
 * be created resolves like the hub will resolve it once it does. Only a
 * missing entry climbs; any other failure keeps the path as it was given.
 */
export const realPath = Effect.fn('realPath')(function* (target: string) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;

  const climb = (current: string): Effect.Effect<string> =>
    fs.realPath(current).pipe(
      Effect.catch(error => {
        const parent = paths.dirname(current);
        if (error.reason._tag !== 'NotFound' || parent === current) {
          return Effect.succeed(current);
        }
        return climb(parent).pipe(
          Effect.map(real => paths.join(real, paths.basename(current)))
        );
      })
    );
  return yield* climb(target);
});

/**
 * The absolute real path of an ERD document an agent named, relative paths
 * against the server's working directory. With create, a name without any
 * extension gets .erd.json; any other non ERD path is refused.
 */
export const resolveDocumentPath = Effect.fn('resolveDocumentPath')(function* (
  input: string,
  create = false
) {
  const paths = yield* Path.Path;
  const { cwd } = yield* ProcessInfo;
  if (input.trim() === '') {
    return yield* new SessionError(
      SessionErrorCode.invalidPath,
      'path is empty'
    );
  }

  let absolute = paths.resolve(cwd, input);
  if (!isErdPath(absolute)) {
    if (!create || paths.extname(absolute) !== '') {
      return yield* new SessionError(
        SessionErrorCode.invalidPath,
        `${absolute} is not an ERD document; use a ${ERD_EXTENSIONS.map(extension => `.${extension}`).join(', ')} file, and ${DEFAULT_EXTENSION} for a new one`
      );
    }
    absolute += DEFAULT_EXTENSION;
  }
  return yield* realPath(absolute);
});
