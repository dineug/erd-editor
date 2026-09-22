import { createAgentPeer, type ReadFormat } from '@dineug/erd-editor/agent.js';
import type { DocumentInfo } from '@dineug/erd-editor-agent-hub';

import { errnoCode, messageOf, SessionError, SessionErrorCode } from '@/errors';
import { type McpIo } from '@/io';
import { isErdPath, pathsOf } from '@/paths';

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
  const peer = createAgentPeer({ nickname: '', presence: false });
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
export function assertDocumentText(path: string, text: string): void {
  if (text.trim() === '') return;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw invalidDocument(path, `is not valid JSON (${messageOf(error)})`);
  }
  const keys =
    json !== null && typeof json === 'object' && !Array.isArray(json)
      ? Object.keys(json)
      : null;
  if (!keys || (keys.length && !keys.some(key => DOCUMENT_KEYS.has(key)))) {
    throw invalidDocument(path, 'holds JSON that is not an ERD document');
  }
}

/** Runs an fs call on a document, a missing file refused with notFound. */
export async function orNotFound<T>(
  path: string,
  task: Promise<T>
): Promise<T> {
  try {
    return await task;
  } catch (error) {
    if (errnoCode(error) === 'ENOENT') {
      throw new SessionError(
        'notFound',
        `${path} does not exist; erd_open_document with create true makes a new document`
      );
    }
    throw error;
  }
}

/** Reads a document file: a missing one is notFound, one the engine cannot read invalidDocument. */
export async function readDocumentFile(
  io: McpIo,
  path: string
): Promise<string> {
  const text = stripBom(await orNotFound(path, io.readFile(path)));
  assertDocumentText(path, text);
  return text;
}

/** Serializes the file on disk without keeping a session, for a window whose hub is off. */
export async function readFromDisk(
  io: McpIo,
  path: string,
  format: ReadFormat,
  vendor?: string
): Promise<string> {
  const text = await readDocumentFile(io, path);
  const peer = createAgentPeer({ nickname: '', presence: false });
  try {
    peer.setInitialValue(text);
    return peer.read(format, vendor);
  } finally {
    peer.destroy();
  }
}

/** ERD files under root, none of them open: what a listing shows with no hub to ask. */
export async function listDiskDocuments(
  io: McpIo,
  root: string
): Promise<DocumentInfo[]> {
  const paths = pathsOf(io.platform());
  const documents: DocumentInfo[] = [];

  const walk = async (dir: string, depth: number): Promise<void> => {
    const entries = await io.readdir(dir).catch(() => []);
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const { name, directory } of sorted) {
      if (documents.length >= MAX_LISTED_DOCUMENTS) return;
      const path = paths.join(dir, name);

      if (directory) {
        if (
          depth < MAX_LIST_DEPTH &&
          !name.startsWith('.') &&
          !SKIPPED_DIRECTORIES.has(name)
        ) {
          await walk(path, depth + 1);
        }
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
  };

  await walk(root, 0);
  return documents;
}
