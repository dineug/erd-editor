import {
  type DiscoveryResult,
  type DocumentInfo,
  type LockCandidate,
} from '@dineug/erd-editor-agent-hub';

import { SessionError, SessionErrorCode } from '@/errors';
import { connectHub } from '@/hubClient';
import { type McpIo } from '@/io';
import { log } from '@/log';
import { realPath, resolveDocumentPath, sessionKey } from '@/paths';
import {
  createEmptyDocument,
  listDiskDocuments,
  readFromDisk,
} from '@/session/disk';
import { openHeadlessSession } from '@/session/headless';
import { createLiveSession, type LiveSession } from '@/session/live';
import { discover } from '@/session/resolve';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type SessionMode,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import type { ReadFormat } from '@/tools/read';

/** A session idle this long is closed; the next call opens a new one and reseeds. */
export const IDLE_TTL_MS = 30 * 60 * 1000;

export const FELL_BACK_NOTE =
  'The VS Code window that served this document has exited, so this call edited the file on disk instead; edits made through that window can no longer be undone.';

export const LEFT_DISK_NOTE =
  'A VS Code window now serves this document, so this call read it from the editor; edits made on disk earlier stay but can no longer be undone.';

export const DISK_READ_NOTE =
  'Read from the file on disk: the VS Code window holding this document cannot be reached, so edits not yet saved in its editor are missing.';

export type Mode = SessionMode | 'blocked';

export type WithMode<T> = T & { mode: Mode; path: string };

export type ListOutcome = {
  mode: Mode;
  documents: DocumentInfo[];
  notes: Notes;
};

export type OpenOutcome = {
  mode: SessionMode;
  path: string;
  created: boolean;
  opened: boolean;
  notes: Notes;
};

export type SessionManager = {
  listDocuments: () => Promise<ListOutcome>;
  openDocument: (path: string, create: boolean) => Promise<OpenOutcome>;
  runTool: (
    path: string,
    name: string,
    args: Record<string, unknown>
  ) => Promise<WithMode<ToolOutcome>>;
  read: (
    path: string,
    format: ReadFormat,
    vendor?: string
  ) => Promise<WithMode<ReadOutcome>>;
  save: (path: string) => Promise<WithMode<SaveOutcome>>;
  undo: (path: string) => Promise<WithMode<UndoOutcome>>;
  redo: (path: string) => Promise<WithMode<UndoOutcome>>;
  /** Closes every session idle for idleTtlMs; resolves with their paths. */
  sweep: () => Promise<string[]>;
  closeAll: () => Promise<void>;
  /** The documents with an open session, for the idle and state specs. */
  paths: () => string[];
};

export type SessionManagerOptions = {
  io: McpIo;
  /** The MCP client's name: the peer's nickname and what hello carries. */
  clientName: () => string;
  idleTtlMs?: number;
  now?: () => number;
  requestTimeoutMs?: number;
};

type Entry = { session: DocumentSession; lastUsed: number };

type Intent = 'read' | 'write';

function blockedError(path: string, candidate: LockCandidate): SessionError {
  return new SessionError(
    SessionErrorCode.blocked,
    `${path} belongs to a VS Code window (pid ${candidate.pid}) whose ERD Editor hub is turned off or failed to start, so edits are refused: the open editor would overwrite them. Trust the workspace and turn on the dineug.erd-editor.agentHub.enabled setting, or reload the window, then call again. Reading still works.`
  );
}

function hubAppearedError(path: string, pid: number): SessionError {
  return new SessionError(
    SessionErrorCode.hubAppeared,
    `A VS Code window (pid ${pid}) now serves ${path}, so this edit was not written to the file under its editor. Call the tool again to edit through that window.`
  );
}

function hubGoneError(path: string, pid: number): SessionError {
  return new SessionError(
    SessionErrorCode.hubGone,
    `The VS Code window (pid ${pid}) that served ${path} still runs, but its lock file is gone and the connection closed, so nothing was written. Reload that window, or close it to edit the file directly.`
  );
}

const isLive = (session: DocumentSession | undefined): session is LiveSession =>
  session?.mode === 'live';

/**
 * One session per document, chosen again on every call: a write never lands
 * on disk under an editor, and a live session falls back to the file only
 * when its window has exited, saying so.
 */
export function createSessionManager(
  options: SessionManagerOptions
): SessionManager {
  const { io } = options;
  const idleTtlMs = options.idleTtlMs ?? IDLE_TTL_MS;
  const now = options.now ?? Date.now;
  const platform = io.platform();
  const sessions = new Map<string, Entry>();
  const locks = new Map<string, Promise<unknown>>();
  /** Documents with a call running, which a sweep from another call must not close. */
  const busy = new Set<string>();

  /** Calls on one document run one at a time; different documents run side by side. */
  const serialize = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const previous = locks.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    const settled = next.catch(() => undefined);
    locks.set(key, settled);
    settled.then(() => {
      if (locks.get(key) === settled) locks.delete(key);
    });
    return next;
  };

  const put = <T extends DocumentSession>(key: string, session: T): T => {
    sessions.set(key, { session, lastUsed: now() });
    return session;
  };

  const exists = (path: string) =>
    io.stat(path).then(
      () => true,
      () => false
    );

  const drop = async (key: string) => {
    const entry = sessions.get(key);
    sessions.delete(key);
    await entry?.session.close().catch(error => log('close failed', error));
  };

  const newLive = (key: string, path: string, candidate: LockCandidate) =>
    put(
      key,
      createLiveSession({
        io,
        path,
        candidate,
        nickname: options.clientName(),
        client: options.clientName(),
        requestTimeoutMs: options.requestTimeoutMs,
      })
    );

  const newHeadless = async (key: string, path: string, create = false) =>
    put(
      key,
      await openHeadlessSession({
        io,
        path,
        nickname: options.clientName(),
        create,
      })
    );

  /**
   * The session for a call, or null when a read should come from disk. The
   * rules: a hub false lock refuses writes, a new hub closes a disk session,
   * and a live session goes to disk only once its window has exited.
   */
  const acquire = async (
    key: string,
    path: string,
    intent: Intent,
    resolution: DiscoveryResult,
    notes: Notes,
    create = false
  ): Promise<DocumentSession | null> => {
    const existing = sessions.get(key)?.session;

    if (resolution.kind === 'blocked') {
      if (intent === 'write') throw blockedError(path, resolution.candidate);
      return null;
    }

    if (resolution.kind === 'live') {
      if (existing && !isLive(existing)) {
        await drop(key);
        if (intent === 'write') {
          throw hubAppearedError(path, resolution.candidate.pid);
        }
        notes.push(LEFT_DISK_NOTE);
      } else if (isLive(existing)) {
        existing.setCandidate(resolution.candidate);
        return existing;
      }
      return newLive(key, path, resolution.candidate);
    }

    if (isLive(existing)) {
      if (existing.connected) return existing;
      if (io.isAlive(existing.pid)) {
        if (intent === 'write') throw hubGoneError(path, existing.pid);
        return null;
      }
      await drop(key);
      notes.push(FELL_BACK_NOTE);
    } else if (existing) {
      // A create on a file deleted under the session starts over from a new file.
      if (!create || (await exists(path))) return existing;
      await drop(key);
    }
    return newHeadless(key, path, create);
  };

  /** Resolves the path, sweeps idle sessions and runs task on the document's queue. */
  const onDocument = async <T>(
    input: string,
    task: (key: string, path: string) => Promise<T>,
    create = false
  ): Promise<T> => {
    await sweep();
    const path = await resolveDocumentPath(io, input, create);
    const key = sessionKey(path, platform);

    return serialize(key, async () => {
      busy.add(key);
      try {
        return await task(key, path);
      } finally {
        busy.delete(key);
        const entry = sessions.get(key);
        if (entry) entry.lastUsed = now();
      }
    });
  };

  const write = <T extends { notes: Notes }>(
    input: string,
    task: (session: DocumentSession) => Promise<T>
  ): Promise<WithMode<T>> =>
    onDocument(input, async (key, path) => {
      const notes: Notes = [];
      const resolution = await discover(io, path);
      const session = (await acquire(key, path, 'write', resolution, notes))!;
      const outcome = await task(session);
      return {
        ...outcome,
        notes: [...notes, ...outcome.notes],
        mode: session.mode,
        path,
      };
    });

  const sweep = async (): Promise<string[]> => {
    const closed: string[] = [];
    const time = now();
    for (const [key, entry] of Array.from(sessions)) {
      if (busy.has(key) || time - entry.lastUsed < idleTtlMs) continue;
      closed.push(entry.session.path);
      await drop(key);
    }
    return closed;
  };

  return {
    listDocuments: async () => {
      await sweep();
      const cwd = await realPath(io, io.cwd());
      const resolution = await discover(io, cwd);

      if (resolution.kind === 'live') {
        const client = await connectHub(io, resolution.candidate, {
          client: options.clientName(),
          requestTimeoutMs: options.requestTimeoutMs,
        });
        try {
          const { documents } = await client.request('listDocuments', {});
          return { mode: 'live', documents, notes: [] };
        } finally {
          client.close();
        }
      }

      const documents = await listDiskDocuments(io, cwd);
      return resolution.kind === 'blocked'
        ? {
            mode: 'blocked',
            documents,
            notes: [blockedError(cwd, resolution.candidate).message],
          }
        : { mode: 'headless', documents, notes: [] };
    },

    openDocument: (input, create) =>
      onDocument(
        input,
        async (key, path) => {
          const notes: Notes = [];
          const existed = await exists(path);
          const resolution = await discover(io, path);
          const session = (await acquire(
            key,
            path,
            'write',
            resolution,
            notes,
            create
          ))!;

          let opened = false;
          if (isLive(session)) {
            const result = await session.open(
              create ? createEmptyDocument() : undefined
            );
            opened = result.opened;
            notes.push(...result.notes);
          }
          const created = !existed && (await exists(path));
          return { mode: session.mode, path, created, opened, notes };
        },
        create
      ),

    runTool: (input, name, args) =>
      write(input, session => session.runTool(name, args)),

    read: (input, format, vendor) =>
      onDocument(input, async (key, path) => {
        const notes: Notes = [];
        const resolution = await discover(io, path);
        const session = await acquire(key, path, 'read', resolution, notes);
        if (!session) {
          const text = await readFromDisk(io, path, format, vendor);
          notes.push(DISK_READ_NOTE);
          const mode: Mode =
            resolution.kind === 'blocked' ? 'blocked' : 'headless';
          return { text, notes, mode, path };
        }
        const outcome = await session.read(format, vendor);
        return {
          text: outcome.text,
          notes: [...notes, ...outcome.notes],
          mode: session.mode,
          path,
        };
      }),

    save: input => write(input, session => session.save()),
    undo: input => write(input, session => session.undo()),
    redo: input => write(input, session => session.redo()),

    sweep,

    closeAll: async () => {
      for (const key of Array.from(sessions.keys())) await drop(key);
    },

    paths: () => Array.from(sessions.values(), ({ session }) => session.path),
  };
}
