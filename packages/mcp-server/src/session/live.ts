import {
  createPeerStore,
  type PeerStore,
  type RevertResult,
} from '@dineug/erd-editor/peer.js';
import {
  HubErrorCode,
  type HubNotification,
  isSamePath,
  type LockCandidate,
} from '@dineug/erd-editor-agent-hub';

import { isSessionError, SessionError } from '@/errors';
import { connectHub, type HubClient } from '@/hubClient';
import { type McpIo } from '@/io';
import { logUnsafe } from '@/logger';
import { assertDocumentText, stripBom } from '@/session/disk';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type SessionState,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import { readDocument, type ReadFormat } from '@/tools/read';
import { runTool as runPeerTool, type ToolRun } from '@/tools/run';

export const RESEED_NOTE =
  'The document was joined again from the editor, so edits made before this call can no longer be undone with erd_undo.';

export const REJOIN_NOTE =
  'The editor had dropped this agent from the document, so it was opened and joined again and the call ran once more.';

export const CLOSED_NOTE =
  "The editor on this document was closed after this agent's last edit, so those edits are in the file only if they were saved before it closed; erd_read shows what it holds now.";

export type LiveSession = DocumentSession & {
  readonly mode: 'live';
  /** The pid of the window this session talks to. */
  readonly pid: number;
  readonly connected: boolean;
  /** The window discovery picked for this call; another pid moves the session there. */
  setCandidate: (candidate: LockCandidate) => void;
  /** Opens the editor if needed and joins, as a write does; create writes an empty document first. */
  open: (initialValue?: string) => Promise<{ opened: boolean; notes: Notes }>;
  /** Leaves the document on the hub; the next write joins again. */
  leave: () => Promise<void>;
};

export type LiveSessionOptions = {
  io: McpIo;
  path: string;
  candidate: LockCandidate;
  nickname: string;
  /** The MCP client name hello carries. */
  client: string;
  requestTimeoutMs?: number;
};

/** How far the peer is joined: seeded may be a read of the file, registered receives every edit. */
type Joined = 'none' | 'seeded' | 'registered';

/**
 * A document inside a VS Code window. A write opens the editor if needed and
 * joins, so the peer holds the editor's state and clock; each outbound batch
 * is an applyActions request, one at a time, and the call waits for them.
 */
export function createLiveSession(options: LiveSessionOptions): LiveSession {
  const { io, path, nickname } = options;
  const platform = io.platform();
  const peer: PeerStore = createPeerStore({ nickname, presence: true });

  let candidate = options.candidate;
  let connection: HubClient | null = null;
  let state: SessionState = 'reconnecting';
  let joined: Joined = 'none';
  let seeded = false;
  let edits = 0;
  /** The editor closed with this agent's edits behind it; every call says so until a reseed. */
  let closedAfterEdits = false;
  let subscribed = false;
  let closed = false;
  let callErrors: unknown[] | null = null;
  let outbound: Promise<void> = Promise.resolve();

  const forget = (next: SessionState) => {
    state = next;
    joined = 'none';
  };

  const onNotification = (notification: HubNotification) => {
    if (!isSamePath(notification.params.path, path, platform)) return;

    if (notification.method === 'actions') {
      peer.receive(notification.params.actions as any[]);
    } else {
      if (edits > 0) closedAfterEdits = true;
      forget('reconnecting');
    }
  };

  /** The connection to the chosen window, a new one when it closed or the window changed. */
  const ensureConnected = async (): Promise<HubClient> => {
    if (connection && !connection.closed && connection.pid === candidate.pid) {
      return connection;
    }
    const previous = connection;
    connection = null;
    forget('reconnecting');
    previous?.close();

    let client: HubClient | null = null;
    client = await connectHub(io, candidate, {
      client: options.client,
      requestTimeoutMs: options.requestTimeoutMs,
      onNotification,
      onClose: () => {
        if (connection !== client) return;
        connection = null;
        forget('reconnecting');
      },
    });
    connection = client;
    return client;
  };

  const report = (error: unknown, errors: unknown[] | null) => {
    if (errors) {
      errors.push(error);
    } else {
      logUnsafe(`a batch for ${path} did not reach the editor`, error);
    }
  };

  /** The one way out of the peer: in order, and never before this agent is registered. */
  const enqueueOutbound = (actions: unknown[]) => {
    const client = connection;
    const errors = callErrors;
    if (joined !== 'registered' || !client) return;

    outbound = outbound.then(async () => {
      try {
        await client.request('applyActions', { path, actions });
      } catch (error) {
        report(error, errors);
      }
    });
  };

  const joinAndSeed = async (
    client: HubClient,
    notes: Notes,
    registered: boolean
  ) => {
    const result = await client.request('join', { path });
    // A closed document is answered from disk, which may hold bytes the engine cannot read.
    assertDocumentText(path, stripBom(result.initialValue));
    if (seeded && edits > 0) notes.push(RESEED_NOTE);

    peer.setInitialValue(result.initialValue);
    peer.mergeClock(result.snapshotVersion);
    peer.setReadonly(result.readonly);
    seeded = true;
    edits = 0;
    closedAfterEdits = false;
    joined = registered ? 'registered' : 'seeded';
    state = 'ready';

    if (registered && !subscribed) {
      subscribed = true;
      peer.subscribe(enqueueOutbound);
    }
  };

  /** openDocument answers at once when a ready editor shows the file, so it runs every time. */
  const prepareWrite = async (notes: Notes, initialValue?: string) => {
    const client = await ensureConnected();
    const opened = await client.request(
      'openDocument',
      initialValue === undefined
        ? { path }
        : { path, create: true, initialValue }
    );
    if (opened.opened || joined !== 'registered' || state !== 'ready') {
      await joinAndSeed(client, notes, true);
    }
    return opened;
  };

  const prepareRead = async (notes: Notes) => {
    const client = await ensureConnected();
    if (joined !== 'registered' || state !== 'ready') {
      await joinAndSeed(client, notes, false);
    }
  };

  /** Runs one peer call and waits for every batch it sent; a refusal comes back in errors. */
  const withOutbound = async <T>(
    task: () => Promise<T>
  ): Promise<{ value: T; errors: unknown[] }> => {
    const errors: unknown[] = [];
    callErrors = errors;
    try {
      const value = await task();
      await outbound;
      return { value, errors };
    } finally {
      callErrors = null;
    }
  };

  /** Every call starts here: refused once closed, told of an editor closed under its edits. */
  const begin = (): Notes => {
    if (closed) {
      throw new SessionError(
        'notOpen',
        `The session on ${path} was closed; call the tool again`
      );
    }
    return closedAfterEdits ? [CLOSED_NOTE] : [];
  };

  const runOnce = async (name: string, args: Record<string, unknown>) => {
    const { value, errors } = await withOutbound(async () =>
      runPeerTool(peer, name, args)
    );
    return { run: value, error: errors[0] };
  };

  const runTool = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolOutcome> => {
    const notes = begin();
    await prepareWrite(notes);

    let { run, error } = await runOnce(name, args);
    if (isSessionError(error, HubErrorCode.notOpen)) {
      forget('reconnecting');
      notes.push(REJOIN_NOTE);
      await prepareWrite(notes);
      ({ run, error } = await runOnce(name, args));
    }
    // The peer holds an edit the editor refused, so the next call reseeds it away.
    if (error) {
      forget('reconnecting');
      throw error;
    }
    if (run.historyEntries) edits++;
    return { run: run as ToolRun, notes };
  };

  const replay = async (step: () => RevertResult): Promise<UndoOutcome> => {
    const notes = begin();
    await prepareWrite(notes);

    const { value, errors } = await withOutbound(async () => step());
    if (errors.length) {
      forget('reconnecting');
      throw errors[0];
    }
    return { result: value, notes };
  };

  return {
    path,
    mode: 'live',
    get state() {
      return state;
    },
    get pid() {
      return candidate.pid;
    },
    get connected() {
      return connection !== null && !connection.closed;
    },

    setCandidate: next => {
      candidate = next;
    },

    open: async initialValue => {
      const notes = begin();
      const { opened } = await prepareWrite(notes, initialValue);
      return { opened, notes };
    },

    runTool,

    read: async (format: ReadFormat, vendor?: string): Promise<ReadOutcome> => {
      const notes = begin();
      await prepareRead(notes);
      return { text: readDocument(peer.state, format, vendor), notes };
    },

    // The hub answers saved false both when it could not confirm every edit
    // reached the editor and when VS Code kept the tab dirty, so the message
    // names both.
    save: async (): Promise<SaveOutcome> => {
      const notes = begin();
      const client = await ensureConnected();
      await outbound;
      const { saved } = await client.request('save', { path });
      if (!saved) {
        throw new SessionError(
          'notSaved',
          `The editor did not save ${path}: it could not confirm that every edit reached it, or VS Code kept the tab unsaved (for example because the file changed on disk). Check the editor, then call erd_save again.`
        );
      }
      return { saved, notes };
    },

    undo: () => replay(() => peer.undo()),
    redo: () => replay(() => peer.redo()),

    leave: async () => {
      if (connection && joined !== 'none') {
        await connection.request('leave', { path });
      }
      forget('detached');
    },

    // Closing the connection drops this peer from every document on the hub,
    // so no leave is sent: a shutdown never waits on a slow window.
    close: async () => {
      if (closed) return;
      closed = true;
      const client = connection;
      connection = null;
      forget('detached');
      client?.close();
      peer.destroy();
    },
  };
}
