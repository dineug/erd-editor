import {
  createPeerStore,
  type PeerStore,
  PeerStoreError,
  PeerStoreErrorCode,
} from '@dineug/erd-editor/peer.js';

import { errnoCode, SessionError, SessionErrorCode } from '@/errors';
import { type FileStat, type McpIo } from '@/io';
import { pathsOf } from '@/paths';
import {
  createEmptyDocument,
  orNotFound,
  readDocumentFile,
} from '@/session/disk';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import { readDocument, type ReadFormat } from '@/tools/read';
import { runTool } from '@/tools/run';

export const HEADLESS_SAVE_NOTE =
  'No editor holds this document, so every edit was already written to the file; there is nothing to save.';

export const RELOADED_NOTE =
  'The file changed on disk since the last call, so it was loaded again; edits made before that can no longer be undone.';

export type HeadlessSession = DocumentSession & { readonly mode: 'headless' };

export type HeadlessSessionOptions = {
  io: McpIo;
  path: string;
  nickname: string;
  /** Writes an empty document first when no file is there. */
  create?: boolean;
};

const sameStat = (a: FileStat, b: FileStat) =>
  a.size === b.size && a.mtimeMs === b.mtimeMs;

const ignore = () => undefined;

async function createIfMissing(io: McpIo, path: string): Promise<void> {
  try {
    await io.createFile(path, createEmptyDocument());
  } catch (error) {
    if (errnoCode(error) === 'EEXIST') return;
    if (errnoCode(error) === 'ENOENT') {
      throw new SessionError(
        'notFound',
        `The folder of ${path} does not exist`
      );
    }
    throw error;
  }
}

/**
 * Edits the file with no editor in between: each call loads what is on disk
 * if it changed, runs on a peer that sends no presence, and replaces the file
 * atomically, refusing when the file changed during the call.
 */
export async function openHeadlessSession({
  io,
  path,
  nickname,
  create = false,
}: HeadlessSessionOptions): Promise<HeadlessSession> {
  if (create) await createIfMissing(io, path);

  const paths = pathsOf(io.platform());
  const peer: PeerStore = createPeerStore({ nickname, presence: false });
  let loaded: FileStat;
  let edits = 0;

  // The stat comes before the read, so a write landing after it never passes
  // for the baseline: the next refresh loads it, or the swap check refuses.
  const load = async () => {
    const stat = await orNotFound(path, io.stat(path));
    const text = await readDocumentFile(io, path);
    peer.setInitialValue(text);
    loaded = stat;
    edits = 0;
  };

  try {
    await load();
  } catch (error) {
    peer.destroy();
    throw error;
  }

  /** Picks up an edit made outside this session, which only a reload can take in. */
  const refresh = async (): Promise<Notes> => {
    const current = await io.stat(path).catch(ignore);
    if (current && sameStat(current, loaded)) return [];

    const hadEdits = edits > 0;
    await load();
    return hadEdits ? [RELOADED_NOTE] : [];
  };

  const reloadQuietly = () => load().catch(ignore);

  /**
   * Temp file with the document's permission bits (owner write kept, so it can
   * always be cleaned up), then compare the stat taken at load, then rename.
   * A rename keeps size and mtime, so the temp file's stat is the new baseline.
   */
  const persist = async () => {
    const temp = paths.join(
      paths.dirname(path),
      `.${paths.basename(path)}.${io.randomId()}.tmp`
    );
    try {
      await io.writeFile(temp, peer.value, loaded.mode | 0o200);
      const written = await io.stat(temp);
      const current = await io.stat(path);
      if (!sameStat(current, loaded)) {
        await io.unlink(temp).catch(ignore);
        await reloadQuietly();
        throw new SessionError(
          SessionErrorCode.conflict,
          `${path} changed on disk during this call, so the edit was not written; it was loaded again, call the tool again`
        );
      }
      await io.rename(temp, path);
      loaded = written;
    } catch (error) {
      if (error instanceof SessionError) throw error;
      await io.unlink(temp).catch(ignore);
      await reloadQuietly();
      throw error;
    }
  };

  return {
    path,
    mode: 'headless',
    state: 'ready',

    runTool: async (name, args): Promise<ToolOutcome> => {
      const notes = await refresh();
      const run = runTool(peer, name, args);
      if (run.actions.length) {
        await persist();
        if (run.historyEntries) edits++;
      }
      return { run, notes };
    },

    // readDocument takes the state straight, so the refusal the peer facade
    // used to raise on a closed store is kept here.
    read: async (format: ReadFormat, vendor?: string): Promise<ReadOutcome> => {
      const notes = await refresh();
      if (peer.isDestroyed) {
        throw new PeerStoreError(PeerStoreErrorCode.destroyed, 'erd_read');
      }
      return { text: readDocument(peer.state, format, vendor), notes };
    },

    save: async (): Promise<SaveOutcome> => ({
      saved: true,
      notes: [HEADLESS_SAVE_NOTE],
    }),

    undo: async (): Promise<UndoOutcome> => {
      const notes = await refresh();
      const result = peer.undo();
      if (result.entries) await persist();
      return { result, notes };
    },

    redo: async (): Promise<UndoOutcome> => {
      const notes = await refresh();
      const result = peer.redo();
      if (result.entries) await persist();
      return { result, notes };
    },

    close: async () => {
      peer.destroy();
    },
  };
}
