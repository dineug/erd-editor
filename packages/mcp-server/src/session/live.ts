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
import { Deferred, Effect, Exit, Queue, Scope } from 'effect';

import { isSessionError, SessionError } from '@/errors';
import { type HubClient, HubConnector } from '@/hub/client';
import { ProcessInfo } from '@/io/process';
import { assertDocumentText, stripBom } from '@/session/disk';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type SessionCall,
  type SessionState,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import type { DocumentReader } from '@/tools/read';
import { runTool as runPeerTool } from '@/tools/run';

export const RESEED_NOTE =
  'The document was joined again from the editor, so edits made before this call can no longer be undone with erd_undo.';

export const REJOIN_NOTE =
  'The editor had dropped this agent from the document, so it was opened and joined again and the call ran once more.';

export const CLOSED_NOTE =
  "The editor on this document was closed after this agent's last edit, so those edits are in the file only if they were saved before it closed; erd_list shows what it holds now.";

export type LiveSession = DocumentSession & {
  readonly mode: 'live';
  /** The pid of the window this session talks to. */
  readonly pid: number;
  readonly connected: boolean;
  /** The window discovery picked for this call; another pid moves the session there. */
  readonly setCandidate: (candidate: LockCandidate) => void;
  /** Opens the editor if needed and joins, as a write does; create writes an empty document first. */
  readonly open: (
    initialValue?: string
  ) => SessionCall<{ opened: boolean; notes: Notes }>;
  /** Leaves the document on the hub; the next write joins again. */
  readonly leave: SessionCall<void>;
};

export type LiveSessionOptions = {
  path: string;
  candidate: LockCandidate;
  nickname: string;
  /** The MCP client name hello carries. */
  client: string;
};

/** How far the peer is joined: seeded may be a read of the file, registered receives every edit. */
type Joined = 'none' | 'seeded' | 'registered';

/** One outbound batch, the call it belongs to, if any, and when it has gone. */
type Outbound = {
  client: HubClient;
  actions: unknown[];
  errors: unknown[] | null;
  sent: Deferred.Deferred<void>;
};

const attempt = <A>(evaluate: () => A) =>
  Effect.try({ try: evaluate, catch: error => error });

/**
 * A document inside a VS Code window. A write opens the editor if needed and
 * joins, so the peer holds the editor's state and clock; each outbound batch
 * is an applyActions request, one at a time, and the call waits for them.
 */
export const makeLiveSession = Effect.fn('makeLiveSession')(function* (
  options: LiveSessionOptions
) {
  const connector = yield* HubConnector;
  const { platform } = yield* ProcessInfo;
  const { path, nickname } = options;
  const scope = yield* Scope.make();
  const peer: PeerStore = createPeerStore({ nickname, presence: true });
  const outbound = yield* Queue.unbounded<Outbound>();

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
  let lastSent = Deferred.makeUnsafe<void>();
  Deferred.doneUnsafe(lastSent, Exit.void);

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

  const report = (error: unknown, errors: unknown[] | null) =>
    errors
      ? Effect.sync(() => void errors.push(error))
      : Effect.logError(`a batch for ${path} did not reach the editor`, error);

  /** One batch as an applyActions request; a refusal goes to its call, and sent settles either way. */
  const deliver = ({ client, actions, errors, sent }: Outbound) =>
    client.request('applyActions', { path, actions }).pipe(
      Effect.catch(error => report(error, errors)),
      Effect.ensuring(Deferred.done(sent, Exit.void))
    );

  // Batches leave in the order the peer made them, each one answered before the next.
  yield* Queue.take(outbound).pipe(
    Effect.flatMap(deliver),
    Effect.forever,
    Effect.forkIn(scope)
  );

  /** The one way out of the peer: in order, and never before this agent is registered. */
  const enqueueOutbound = (actions: unknown[]) => {
    const client = connection;
    const errors = callErrors;
    if (joined !== 'registered' || !client) return;

    const sent = Deferred.makeUnsafe<void>();
    lastSent = sent;
    Queue.offerUnsafe(outbound, { client, actions, errors, sent });
  };

  const awaitOutbound = Effect.suspend(() => Deferred.await(lastSent));

  /** The frames the connection already read are taken, notifications applied. */
  const drained = Effect.suspend(() =>
    connection ? connection.drained : Effect.void
  );

  /** The connection to the chosen window, a new one when it closed or the window changed. */
  const ensureConnected = Effect.gen(function* () {
    if (connection && !connection.closed && connection.pid === candidate.pid) {
      return connection;
    }
    const previous = connection;
    connection = null;
    forget('reconnecting');
    if (previous) yield* previous.close;

    let client: HubClient | null = null;
    client = yield* connector
      .connect(candidate, {
        client: options.client,
        onNotification,
        onClose: () => {
          if (connection !== client) return;
          connection = null;
          forget('reconnecting');
        },
      })
      .pipe(Scope.provide(scope));
    connection = client;
    return client;
  });

  /**
   * The reseed runs as the join is answered, before the client takes the next
   * frame, so the actions the hub sent after its snapshot land on the new seed.
   */
  const joinAndSeed = (client: HubClient, notes: Notes, registered: boolean) =>
    client.requestThen('join', { path }, result =>
      Effect.gen(function* () {
        // A closed document is answered from disk, which may hold bytes the engine cannot read.
        yield* assertDocumentText(path, stripBom(result.initialValue));
        if (seeded && edits > 0) notes.push(RESEED_NOTE);

        yield* attempt(() => {
          peer.setInitialValue(result.initialValue);
          peer.mergeClock(result.snapshotVersion);
          peer.setReadonly(result.readonly);
        });
        seeded = true;
        edits = 0;
        closedAfterEdits = false;
        joined = registered ? 'registered' : 'seeded';
        state = 'ready';

        if (registered && !subscribed) {
          subscribed = true;
          yield* attempt(() => peer.subscribe(enqueueOutbound));
        }
      })
    );

  /** openDocument answers at once when a ready editor shows the file, so it runs every time. */
  const prepareWrite = (notes: Notes, initialValue?: string) =>
    Effect.gen(function* () {
      const client = yield* ensureConnected;
      const opened = yield* client.request(
        'openDocument',
        initialValue === undefined
          ? { path }
          : { path, create: true, initialValue }
      );
      if (opened.opened || joined !== 'registered' || state !== 'ready') {
        yield* joinAndSeed(client, notes, true);
      }
      return opened;
    });

  const prepareRead = (notes: Notes) =>
    Effect.gen(function* () {
      const client = yield* ensureConnected;
      if (joined !== 'registered' || state !== 'ready') {
        yield* joinAndSeed(client, notes, false);
      }
    });

  /**
   * Runs one peer call and waits for every batch it sent; a refusal comes back
   * in errors. The focus it moved goes out on a microtask, so it yields once
   * first. Each side of it waits for the frames read with the last answer.
   */
  const withOutbound = <A>(task: () => A) =>
    Effect.suspend(() => {
      const errors: unknown[] = [];
      return drained.pipe(
        Effect.andThen(
          Effect.suspend(() => {
            callErrors = errors;
            return attempt(task);
          })
        ),
        Effect.tap(() =>
          Effect.yieldNow.pipe(
            Effect.andThen(awaitOutbound),
            Effect.andThen(drained)
          )
        ),
        Effect.map(value => ({ value, errors })),
        Effect.ensuring(
          Effect.sync(() => {
            callErrors = null;
          })
        )
      );
    });

  /** Every call starts here: refused once closed, told of an editor closed under its edits. */
  const begin = Effect.suspend(() =>
    closed
      ? Effect.fail(
          new SessionError(
            'notOpen',
            `The session on ${path} was closed; call the tool again`
          )
        )
      : Effect.succeed<Notes>(closedAfterEdits ? [CLOSED_NOTE] : [])
  );

  const runOnce = (name: string, args: Record<string, unknown>) =>
    withOutbound(() => runPeerTool(peer, name, args)).pipe(
      Effect.map(({ value, errors }) => ({ run: value, error: errors[0] }))
    );

  const runTool = (name: string, args: Record<string, unknown>) =>
    Effect.gen(function* () {
      const notes = yield* begin;
      yield* prepareWrite(notes);

      let { run, error } = yield* runOnce(name, args);
      if (isSessionError(error, HubErrorCode.notOpen)) {
        forget('reconnecting');
        notes.push(REJOIN_NOTE);
        yield* prepareWrite(notes);
        ({ run, error } = yield* runOnce(name, args));
      }
      // The peer holds an edit the editor refused, so the next call reseeds it away.
      if (error) {
        forget('reconnecting');
        return yield* Effect.fail(error);
      }
      if (run.historyEntries) edits++;
      return { run, notes } satisfies ToolOutcome;
    });

  const replay = (step: () => RevertResult) =>
    Effect.gen(function* () {
      const notes = yield* begin;
      yield* prepareWrite(notes);

      const { value, errors } = yield* withOutbound(step);
      if (errors.length) {
        forget('reconnecting');
        return yield* Effect.fail(errors[0]);
      }
      return { result: value, notes } satisfies UndoOutcome;
    });

  const session: LiveSession = {
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

    open: initialValue =>
      Effect.gen(function* () {
        const notes = yield* begin;
        const { opened } = yield* prepareWrite(notes, initialValue);
        return { opened, notes };
      }),

    runTool,

    read: (reader: DocumentReader) =>
      Effect.gen(function* () {
        const notes = yield* begin;
        yield* prepareRead(notes);
        const text = yield* attempt(() => reader.render(peer.state));
        return { text, notes } satisfies ReadOutcome;
      }),

    // The hub answers saved false both when it could not confirm every edit
    // reached the editor and when VS Code kept the tab dirty, so the message
    // names both.
    save: Effect.gen(function* () {
      const notes = yield* begin;
      const client = yield* ensureConnected;
      yield* awaitOutbound;
      const { saved } = yield* client.request('save', { path });
      if (!saved) {
        return yield* new SessionError(
          'notSaved',
          `The editor did not save ${path}: it could not confirm that every edit reached it, or VS Code kept the tab unsaved (for example because the file changed on disk). Check the editor, then call erd_save again.`
        );
      }
      return { saved, notes } satisfies SaveOutcome;
    }),

    undo: replay(() => peer.undo()),
    redo: replay(() => peer.redo()),

    leave: Effect.gen(function* () {
      if (connection && joined !== 'none') {
        yield* connection.request('leave', { path });
      }
      forget('detached');
    }),

    // Closing the connection drops this peer from every document on the hub,
    // so no leave is sent: a shutdown never waits on a slow window.
    close: Effect.gen(function* () {
      if (closed) return;
      closed = true;
      const client = connection;
      connection = null;
      forget('detached');
      if (client) yield* client.close;
      yield* Scope.close(scope, Exit.void);
      // The batches the outbound fiber never took go on their closed
      // connections, which refuse them at once, so no call waits on one.
      const unsent = yield* Queue.clear(outbound);
      yield* Effect.forEach(unsent, deliver, { discard: true });
      peer.destroy();
    }),
  };
  return session;
});
