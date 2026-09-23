import {
  type DiscoveryResult,
  type DocumentInfo,
  type LockCandidate,
} from '@dineug/erd-editor-agent-hub';
import * as Clock from 'effect/Clock';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';
import * as Path from 'effect/Path';
import * as Schedule from 'effect/Schedule';
import * as Semaphore from 'effect/Semaphore';

import { SessionError, SessionErrorCode } from '@/errors';
import { HubConnector } from '@/hub/client';
import { HubDiscovery } from '@/hub/discovery';
import { ProcessInfo } from '@/io/process';
import { realPath, resolveDocumentPath, sessionKey } from '@/paths';
import {
  createEmptyDocument,
  listDiskDocuments,
  readFromDisk,
} from '@/session/disk';
import { openHeadlessSession } from '@/session/headless';
import { type LiveSession, makeLiveSession } from '@/session/live';
import {
  type DocumentSession,
  type Notes,
  type ReadOutcome,
  type SaveOutcome,
  type SessionCall,
  type SessionMode,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import type { ReadFormat } from '@/tools/read';

/** A session idle this long is closed; the next call opens a new one and reseeds. */
export const IDLE_TTL_MS = 30 * 60 * 1000;

/** How often idle sessions are looked for between calls. */
export const SWEEP_INTERVAL_MS = 60_000;

/** The nickname a peer shows when the client sent no name. */
export const DEFAULT_CLIENT_NAME = 'agent';

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

export type SessionManagerShape = {
  /** Names this server's peers after the MCP client, from the first call that runs. */
  readonly rememberClient: (name: string | undefined) => Effect.Effect<void>;
  readonly listDocuments: SessionCall<ListOutcome>;
  readonly openDocument: (
    path: string,
    create: boolean
  ) => SessionCall<OpenOutcome>;
  readonly runTool: (
    path: string,
    name: string,
    args: Record<string, unknown>
  ) => SessionCall<WithMode<ToolOutcome>>;
  readonly read: (
    path: string,
    format: ReadFormat,
    vendor?: string
  ) => SessionCall<WithMode<ReadOutcome>>;
  readonly save: (path: string) => SessionCall<WithMode<SaveOutcome>>;
  readonly undo: (path: string) => SessionCall<WithMode<UndoOutcome>>;
  readonly redo: (path: string) => SessionCall<WithMode<UndoOutcome>>;
  /** Closes every session idle for IDLE_TTL_MS; succeeds with their paths. */
  readonly sweep: Effect.Effect<string[]>;
  readonly closeAll: Effect.Effect<void>;
  /** The documents with an open session, for the idle and state specs. */
  readonly paths: Effect.Effect<string[]>;
};

/** One session per document, for every tool the server lists. */
export class SessionManager extends Context.Service<
  SessionManager,
  SessionManagerShape
>()('@dineug/erd-editor-mcp/SessionManager') {}

type Entry = { session: DocumentSession; lastUsed: number };

/** A document's queue of calls, dropped once nothing waits on it. */
type Lock = { semaphore: Semaphore.Semaphore; users: number };

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

/** A throw inside a session fails the call, as it rejected one when sessions were promises. */
const failOnDefect = <A>(call: SessionCall<A>): SessionCall<A> =>
  Effect.catchDefect(call, defect => Effect.fail(defect));

/**
 * One session per document, chosen again on every call: a write never lands
 * on disk under an editor, and a live session falls back to the file only
 * when its window has exited, saying so.
 */
const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const process = yield* ProcessInfo;
  const discovery = yield* HubDiscovery;
  const connector = yield* HubConnector;
  const clock = yield* Clock.clockWith(Effect.succeed);
  const services = Context.make(FileSystem.FileSystem, fs).pipe(
    Context.add(Path.Path, yield* Path.Path),
    Context.add(ProcessInfo, process),
    Context.add(HubConnector, connector)
  );
  const withServices = <A, E>(
    effect: Effect.Effect<
      A,
      E,
      FileSystem.FileSystem | Path.Path | ProcessInfo | HubConnector
    >
  ) => Effect.provideContext(effect, services);

  const now = () => clock.currentTimeMillisUnsafe();
  const sessions = new Map<string, Entry>();
  const locks = new Map<string, Lock>();
  /** Documents with a call running, which a sweep from another call must not close. */
  const busy = new Set<string>();
  let clientName: string | undefined;
  const nickname = () => clientName || DEFAULT_CLIENT_NAME;

  /** Calls on one document run one at a time; different documents run side by side. */
  const serialize = <A, E>(key: string, task: Effect.Effect<A, E>) =>
    Effect.suspend(() => {
      let lock = locks.get(key);
      if (!lock) {
        lock = { semaphore: Semaphore.makeUnsafe(1), users: 0 };
        locks.set(key, lock);
      }
      const held = lock;
      held.users++;
      return held.semaphore
        .withPermits(1)(task)
        .pipe(
          Effect.ensuring(
            Effect.sync(() => {
              if (--held.users === 0) locks.delete(key);
            })
          )
        );
    });

  const put = <T extends DocumentSession>(key: string, session: T): T => {
    sessions.set(key, { session, lastUsed: now() });
    return session;
  };

  const exists = (path: string) =>
    fs.stat(path).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );

  const drop = (key: string) =>
    Effect.suspend(() => {
      const entry = sessions.get(key);
      sessions.delete(key);
      return entry ? entry.session.close : Effect.void;
    });

  const newLive = (key: string, path: string, candidate: LockCandidate) =>
    withServices(
      makeLiveSession({
        path,
        candidate,
        nickname: nickname(),
        client: nickname(),
      })
    ).pipe(Effect.map(session => put(key, session)));

  const newHeadless = (key: string, path: string, create = false) =>
    withServices(
      openHeadlessSession({ path, nickname: nickname(), create })
    ).pipe(Effect.map(session => put(key, session)));

  /**
   * The session for a call, or null when a read should come from disk. The
   * rules: a hub false lock refuses writes, a new hub closes a disk session,
   * and a live session goes to disk only once its window has exited.
   */
  const acquire = Effect.fn('SessionManager.acquire')(function* (
    key: string,
    path: string,
    intent: Intent,
    resolution: DiscoveryResult,
    notes: Notes,
    create = false
  ) {
    const existing = sessions.get(key)?.session;

    if (resolution.kind === 'blocked') {
      if (intent === 'write') {
        return yield* blockedError(path, resolution.candidate);
      }
      return null;
    }

    if (resolution.kind === 'live') {
      if (existing && !isLive(existing)) {
        yield* drop(key);
        if (intent === 'write') {
          return yield* hubAppearedError(path, resolution.candidate.pid);
        }
        notes.push(LEFT_DISK_NOTE);
      } else if (isLive(existing)) {
        existing.setCandidate(resolution.candidate);
        return existing;
      }
      return yield* newLive(key, path, resolution.candidate);
    }

    if (isLive(existing)) {
      if (existing.connected) return existing;
      if (process.isAlive(existing.pid)) {
        if (intent === 'write') return yield* hubGoneError(path, existing.pid);
        return null;
      }
      yield* drop(key);
      notes.push(FELL_BACK_NOTE);
    } else if (existing) {
      // A create on a file deleted under the session starts over from a new file.
      if (!create || (yield* exists(path))) return existing;
      yield* drop(key);
    }
    return yield* newHeadless(key, path, create);
  });

  const sweep = Effect.suspend(() => {
    const time = now();
    const idle = Array.from(sessions).filter(
      ([key, entry]) => !busy.has(key) && time - entry.lastUsed >= IDLE_TTL_MS
    );
    for (const [key] of idle) sessions.delete(key);
    return Effect.forEach(idle, ([, { session }]) => session.close, {
      discard: true,
    }).pipe(Effect.as(idle.map(([, { session }]) => session.path)));
  });

  /**
   * Resolves the path, sweeps idle sessions and runs task on the document's
   * queue. Once it holds the document the task runs to its end, as 0.1.0's
   * did: a cancel between an edit and its write would leave the two apart.
   */
  const onDocument = <A>(
    input: string,
    task: (key: string, path: string) => SessionCall<A>,
    create = false
  ) =>
    Effect.gen(function* () {
      yield* sweep;
      const path = yield* withServices(resolveDocumentPath(input, create));
      const key = sessionKey(path, process.platform);

      return yield* serialize(
        key,
        Effect.suspend(() => {
          busy.add(key);
          return task(key, path);
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              busy.delete(key);
              const entry = sessions.get(key);
              if (entry) entry.lastUsed = now();
            })
          ),
          Effect.uninterruptible
        )
      );
    }).pipe(failOnDefect);

  const write = <T extends { notes: Notes }>(
    input: string,
    task: (session: DocumentSession) => SessionCall<T>
  ) =>
    onDocument(input, (key, path) =>
      Effect.gen(function* () {
        const notes: Notes = [];
        const resolution = yield* discovery.discover(path);
        const session = (yield* acquire(
          key,
          path,
          'write',
          resolution,
          notes
        ))!;
        const outcome = yield* task(session);
        return {
          ...outcome,
          notes: [...notes, ...outcome.notes],
          mode: session.mode,
          path,
        } as WithMode<T>;
      })
    );

  const closeAll = Effect.suspend(() =>
    Effect.forEach(Array.from(sessions.keys()), drop, { discard: true })
  );

  // Finalizers run last first: the sweep stops before every session closes.
  yield* Effect.addFinalizer(() => closeAll);
  yield* Effect.schedule(sweep, Schedule.spaced(SWEEP_INTERVAL_MS)).pipe(
    Effect.forkScoped
  );

  return SessionManager.of({
    rememberClient: name =>
      Effect.sync(() => {
        clientName ??= name;
      }),

    listDocuments: Effect.gen(function* () {
      yield* sweep;
      const cwd = yield* withServices(realPath(process.cwd));
      const resolution = yield* discovery.discover(cwd);

      if (resolution.kind === 'live') {
        const { documents } = yield* connector
          .connect(resolution.candidate, { client: nickname() })
          .pipe(
            Effect.flatMap(client => client.request('listDocuments', {})),
            Effect.scoped
          );
        return { mode: 'live', documents, notes: [] } satisfies ListOutcome;
      }

      const documents = yield* withServices(listDiskDocuments(cwd));
      return (
        resolution.kind === 'blocked'
          ? {
              mode: 'blocked',
              documents,
              notes: [blockedError(cwd, resolution.candidate).message],
            }
          : { mode: 'headless', documents, notes: [] }
      ) satisfies ListOutcome;
    }).pipe(failOnDefect),

    openDocument: (input, create) =>
      onDocument(
        input,
        (key, path) =>
          Effect.gen(function* () {
            const notes: Notes = [];
            const existed = yield* exists(path);
            const resolution = yield* discovery.discover(path);
            const session = (yield* acquire(
              key,
              path,
              'write',
              resolution,
              notes,
              create
            ))!;

            let opened = false;
            if (isLive(session)) {
              const result = yield* session.open(
                create ? createEmptyDocument() : undefined
              );
              opened = result.opened;
              notes.push(...result.notes);
            }
            const created = !existed && (yield* exists(path));
            return {
              mode: session.mode,
              path,
              created,
              opened,
              notes,
            } satisfies OpenOutcome;
          }),
        create
      ),

    runTool: (input, name, args) =>
      write(input, session => session.runTool(name, args)),

    read: (input, format, vendor) =>
      onDocument(input, (key, path) =>
        Effect.gen(function* () {
          const notes: Notes = [];
          const resolution = yield* discovery.discover(path);
          const session = yield* acquire(key, path, 'read', resolution, notes);
          if (!session) {
            const text = yield* withServices(
              readFromDisk(path, format, vendor)
            );
            notes.push(DISK_READ_NOTE);
            const mode: Mode =
              resolution.kind === 'blocked' ? 'blocked' : 'headless';
            return { text, notes, mode, path };
          }
          const outcome = yield* session.read(format, vendor);
          return {
            text: outcome.text,
            notes: [...notes, ...outcome.notes],
            mode: session.mode,
            path,
          };
        })
      ),

    save: input => write(input, session => session.save),
    undo: input => write(input, session => session.undo),
    redo: input => write(input, session => session.redo),

    sweep,
    closeAll,
    paths: Effect.sync(() =>
      Array.from(sessions.values(), ({ session }) => session.path)
    ),
  });
});

/**
 * The session manager as a scoped service: an idle sweep runs beside it on
 * the clock, and closing the scope, as the end of stdin does, closes every
 * session.
 */
export const layer: Layer.Layer<
  SessionManager,
  never,
  FileSystem.FileSystem | Path.Path | ProcessInfo | HubConnector | HubDiscovery
> = Layer.effect(SessionManager, make);
