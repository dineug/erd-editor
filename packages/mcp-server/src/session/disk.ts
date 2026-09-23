import { createPeerStore } from '@dineug/erd-editor/peer.js';
import type { DocumentInfo } from '@dineug/erd-editor-agent-hub';
import { Effect, FileSystem, Path } from 'effect';

import {
  isPlatformReason,
  messageOf,
  SessionError,
  SessionErrorCode,
} from '@/errors';
import { isErdPath } from '@/paths';
import { readDocument, type ReadFormat } from '@/tools/read';

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

/** The editor drops a byte order mark when it reads a file; so do the sessions. */
export function stripBom(text: string): string {
  return text.startsWith('﻿') ? text.slice(1) : text;
}

/** The bytes of a new document: an empty peer's value, $schema stamp included. */
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

/** Serializes the file on disk without keeping a session, for a window whose hub is off. */
export const readFromDisk = Effect.fn('readFromDisk')(function* (
  path: string,
  format: ReadFormat,
  vendor?: string
) {
  const text = yield* readDocumentFile(path);
  return yield* Effect.try({
    try: () => {
      const peer = createPeerStore({ nickname: '', presence: false });
      try {
        peer.setInitialValue(text);
        return readDocument(peer.state, format, vendor);
      } finally {
        peer.destroy();
      }
    },
    catch: error => error,
  });
});

/**
 * ERD files under root, none of them open: what a listing shows with no hub
 * to ask. An entry is looked at only when its name could be walked or listed;
 * a symlink is never walked, as a directory entry of its own kind.
 */
export const listDiskDocuments = Effect.fn('listDiskDocuments')(function* (
  root: string
) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const documents: DocumentInfo[] = [];

  const isDirectory = (path: string) =>
    fs.stat(path).pipe(
      Effect.flatMap(info =>
        info.type === 'Directory'
          ? fs.readLink(path).pipe(
              Effect.as(false),
              Effect.orElseSucceed(() => true)
            )
          : Effect.succeed(false)
      ),
      Effect.orElseSucceed(() => false)
    );

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

        const path = paths.join(dir, name);
        if (yield* isDirectory(path)) {
          if (walkable) yield* walk(path, depth + 1);
        } else if (isErdPath(name)) {
          documents.push({
            path,
            open: false,
            active: false,
            dirty: false,
            readonly: false,
          });
        }
      }
    });

  yield* walk(root, 0);
  return documents;
});
