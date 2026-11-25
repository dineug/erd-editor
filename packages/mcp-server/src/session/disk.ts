import { createPeerStore } from '@dineug/erd-editor/peer.js';
import { type DocumentInfo, unsafeSegment } from '@dineug/erd-editor-agent-hub';
import { Effect, FileSystem, Path, Schedule } from 'effect';

import {
  isPlatformReason,
  messageOf,
  SessionError,
  SessionErrorCode,
} from '@/errors';
import { FileStats } from '@/io/fileSystem';
import { ProcessInfo } from '@/io/process';
import { isErdPath } from '@/paths';
import type { DocumentReader } from '@/tools/read';

/** Directories a listing never walks into: dependencies, VCS data and anything hidden. */
const SKIPPED_DIRECTORIES = new Set(['node_modules']);

/** The top-level keys of a v3 document and of a v2 one; a JSON object with none is something else. */
const DOCUMENT_KEYS = new Set([
  '$schema',
  'version',
  'settings',
  'doc',
  'collections',
  'canvas',
  'table',
  'memo',
  'relationship',
]);

/** A listing stops here, so a huge tree cannot stall a call or flood the result. */
export const MAX_LISTED_DOCUMENTS = 500;
export const MAX_LIST_DEPTH = 8;

/**
 * A mode without owner write, the POSIX bit or on Windows the read-only
 * attribute, which node reads as 0o444: what a headless write refuses and a
 * disk listing reports as readonly.
 */
export function isReadonlyMode(mode: number): boolean {
  return (mode & 0o200) === 0;
}

/**
 * What Windows answers a rename over a file any process holds open: libuv's
 * EPERM, which platform-node folds into Unknown, or EACCES or EBUSY. The tag
 * alone decides, as in its twin, agent-hub-host's lock write.
 */
export const isBusyReplace = (error: unknown): boolean =>
  isPlatformReason(error, 'Unknown') ||
  isPlatformReason(error, 'PermissionDenied') ||
  isPlatformReason(error, 'Busy');

/** 10 ms doubling to 100 ms apart, for 2 s in all: a reader holds a file for milliseconds. */
export const SWAP_RETRY = Schedule.min([
  Schedule.exponential('10 millis'),
  Schedule.spaced('100 millis'),
]).pipe(Schedule.upTo({ duration: '2 seconds' }));

/** The editor drops a byte order mark when it reads a file; so do the sessions. */
export function stripBom(text: string): string {
  return text.startsWith('﻿') ? text.slice(1) : text;
}

/**
 * The bytes of a new document: an empty peer's value, $schema stamp included,
 * every setting locked, as a new diagram in an editor.
 */
export function createEmptyDocument(): string {
  const peer = createPeerStore({ nickname: '', presence: false });
  try {
    return peer.value;
  } finally {
    peer.destroy();
  }
}

function invalidDocument(path: string, what: string): SessionError {
  return new SessionError(
    SessionErrorCode.invalidDocument,
    `${path} ${what}, so it would load as an empty diagram; it was left untouched. Resolve any merge conflict or restore the file, then call again.`
  );
}

/**
 * Refuses text the engine would quietly load as an empty diagram although the
 * file holds something, such as merge conflict markers, a truncated write or
 * unrelated JSON. Blank text is a new document and passes.
 */
export const assertDocumentText = Effect.fn('assertDocumentText')(function* (
  path: string,
  text: string
) {
  if (text.trim() === '') return;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return yield* invalidDocument(
      path,
      `is not valid JSON (${messageOf(error)})`
    );
  }
  const keys =
    json !== null && typeof json === 'object' && !Array.isArray(json)
      ? Object.keys(json)
      : null;
  if (!keys || (keys.length && !keys.some(key => DOCUMENT_KEYS.has(key)))) {
    return yield* invalidDocument(
      path,
      'holds JSON that is not an ERD document'
    );
  }
});

/** Refuses a missing document with notFound, naming the way to make one. */
export const orNotFound =
  (path: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.mapError(effect, error =>
      isPlatformReason(error, 'NotFound')
        ? new SessionError(
            'notFound',
            `${path} does not exist; erd_open_document with create true makes a new document`
          )
        : error
    );

/** Reads a document file: a missing one is notFound, one the engine cannot read invalidDocument. */
export const readDocumentFile = Effect.fn('readDocumentFile')(function* (
  path: string
) {
  const fs = yield* FileSystem.FileSystem;
  const text = stripBom(yield* fs.readFileString(path).pipe(orNotFound(path)));
  yield* assertDocumentText(path, text);
  return text;
});

/**
 * Writes a file that is no document, such as an exported svg: a new one with
 * an exclusive create, one already there through a temp file renamed over it,
 * retried on Windows while another program holds it open. A read-only one is refused.
 */
export const writeFileReplacing = Effect.fn('writeFileReplacing')(function* (
  path: string,
  text: string
) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const { stat } = yield* FileStats;
  const { platform, randomId } = yield* ProcessInfo;

  const created = yield* fs.writeFileString(path, text, { flag: 'wx' }).pipe(
    Effect.as(true),
    Effect.catch(error => {
      if (isPlatformReason(error, 'AlreadyExists'))
        return Effect.succeed(false);
      return Effect.fail(
        isPlatformReason(error, 'NotFound')
          ? new SessionError('notFound', `The folder of ${path} does not exist`)
          : error
      );
    })
  );
  if (created) return;

  const { mode } = yield* stat(path);
  if (isReadonlyMode(mode)) {
    return yield* new SessionError(
      'readonly',
      `${path} is read-only, so it was not written; make it writable or name another file, then call again`
    );
  }
  const temp = paths.join(
    paths.dirname(path),
    `.${paths.basename(path)}.${yield* randomId}.tmp`
  );
  // Each attempt renames anew, however the file system builds its effect.
  const rename = Effect.suspend(() => fs.rename(temp, path));
  yield* fs.writeFileString(temp, text, { mode }).pipe(
    // Windows refuses a rename over a file another process has open.
    Effect.andThen(
      platform === 'win32'
        ? rename.pipe(
            Effect.retry({ schedule: SWAP_RETRY, while: isBusyReplace })
          )
        : rename
    ),
    Effect.onError(() => Effect.ignore(fs.remove(temp)))
  );
});

/** Serializes the file on disk without keeping a session, for a window whose hub is off. */
export const readFromDisk = Effect.fn('readFromDisk')(function* (
  path: string,
  reader: DocumentReader
) {
  const text = yield* readDocumentFile(path);
  return yield* Effect.try({
    try: () => {
      const peer = createPeerStore({ nickname: '', presence: false });
      try {
        peer.setInitialValue(text);
        return reader.render(peer.state);
      } finally {
        peer.destroy();
      }
    },
    catch: error => error,
  });
});

/**
 * ERD files under root, none of them open: what a listing shows with no hub
 * to ask. An entry is looked at only when its name could be walked or listed,
 * and one Windows alters never is; a symlink is never walked.
 */
export const listDiskDocuments = Effect.fn('listDiskDocuments')(function* (
  root: string
) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const { platform } = yield* ProcessInfo;
  const documents: DocumentInfo[] = [];

  /**
   * A directory to walk, else a file and whether it is read-only; a symlink to
   * a directory is never walked, and it and an entry that does not stat read as
   * a writable file.
   */
  const entryAt = (path: string) => {
    const writableFile = { directory: false, readonly: false };
    return fs.stat(path).pipe(
      Effect.flatMap(info =>
        info.type === 'Directory'
          ? fs.readLink(path).pipe(
              Effect.as(writableFile),
              Effect.orElseSucceed(() => ({ directory: true, readonly: false }))
            )
          : Effect.succeed({
              directory: false,
              readonly: isReadonlyMode(info.mode),
            })
      ),
      Effect.orElseSucceed(() => writableFile)
    );
  };

  const walk = (dir: string, depth: number): Effect.Effect<void> =>
    Effect.gen(function* () {
      const names = yield* fs
        .readDirectory(dir)
        .pipe(Effect.orElseSucceed((): string[] => []));

      for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
        if (documents.length >= MAX_LISTED_DOCUMENTS) return;
        const walkable =
          depth < MAX_LIST_DEPTH &&
          !name.startsWith('.') &&
          !SKIPPED_DIRECTORIES.has(name);
        if (!walkable && !isErdPath(name)) continue;
        // Every call on such a name is refused, so the listing never offers it.
        if (unsafeSegment(name, platform) !== null) continue;

        const path = paths.join(dir, name);
        const entry = yield* entryAt(path);
        if (entry.directory) {
          if (walkable) yield* walk(path, depth + 1);
        } else if (isErdPath(name)) {
          documents.push({
            path,
            open: false,
            active: false,
            dirty: false,
            readonly: entry.readonly,
          });
        }
      }
    });

  yield* walk(root, 0);
  return documents;
});
