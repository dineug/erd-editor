import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { type McpIo, nodeIo } from '@/io';
import {
  createSessionManager,
  type ListOutcome,
  type OpenOutcome,
  type SessionManager as SessionCalls,
  type WithMode,
} from '@/session/manager';
import {
  type ReadOutcome,
  type SaveOutcome,
  type ToolOutcome,
  type UndoOutcome,
} from '@/session/types';
import type { ReadFormat } from '@/tools/read';

/** A session call that fails with whatever the call was refused with, as the result reports it. */
type Call<A> = Effect.Effect<A, unknown>;

export type SessionManagerShape = {
  /** Names this server's peers after the MCP client, from the first call that runs. */
  readonly rememberClient: (name: string | undefined) => Effect.Effect<void>;
  readonly listDocuments: Call<ListOutcome>;
  readonly openDocument: (path: string, create: boolean) => Call<OpenOutcome>;
  readonly runTool: (
    path: string,
    name: string,
    args: Record<string, unknown>
  ) => Call<WithMode<ToolOutcome>>;
  readonly read: (
    path: string,
    format: ReadFormat,
    vendor?: string
  ) => Call<WithMode<ReadOutcome>>;
  readonly save: (path: string) => Call<WithMode<SaveOutcome>>;
  readonly undo: (path: string) => Call<WithMode<UndoOutcome>>;
  readonly redo: (path: string) => Call<WithMode<UndoOutcome>>;
  /** Closes every session idle for the idle period; succeeds with their paths. */
  readonly sweep: Call<string[]>;
  readonly closeAll: Call<void>;
  /** The documents with an open session, for the idle and state specs. */
  readonly paths: Effect.Effect<string[]>;
};

/** One session per document, for every tool the server lists. */
export class SessionManager extends Context.Service<
  SessionManager,
  SessionManagerShape
>()('@dineug/erd-editor-mcp/SessionManager') {}

export type SessionManagerOptions = {
  io?: McpIo;
  now?: () => number;
  idleTtlMs?: number;
  requestTimeoutMs?: number;
  /** How often idle sessions are looked for between calls. */
  sweepIntervalMs: number;
  /** The nickname a peer shows when the client sent no name. */
  defaultClientName: string;
};

const call = <A>(task: () => Promise<A>): Call<A> =>
  Effect.tryPromise({ try: task, catch: error => error });

/**
 * The session manager as a scoped service: an idle sweep runs beside it, and
 * closing the scope, as the end of stdin does, closes every session. A failed
 * sweep or shutdown is logged and never ends the server.
 */
const make = (options: SessionManagerOptions) =>
  Effect.gen(function* () {
    let clientName: string | undefined;
    const manager: SessionCalls = createSessionManager({
      io: options.io ?? nodeIo,
      now: options.now,
      idleTtlMs: options.idleTtlMs,
      requestTimeoutMs: options.requestTimeoutMs,
      clientName: () => clientName || options.defaultClientName,
    });

    const sweep = call(() => manager.sweep());
    const closeAll = call(() => manager.closeAll());

    // Finalizers run last first: the sweep stops before every session closes.
    yield* Effect.addFinalizer(() =>
      closeAll.pipe(
        Effect.catch(error => Effect.logError('shutdown failed', error))
      )
    );
    yield* Effect.sleep(options.sweepIntervalMs).pipe(
      Effect.andThen(sweep),
      Effect.catch(error => Effect.logError('idle sweep failed', error)),
      Effect.forever,
      Effect.forkScoped
    );

    return SessionManager.of({
      rememberClient: name =>
        Effect.sync(() => {
          clientName ??= name;
        }),
      listDocuments: call(() => manager.listDocuments()),
      openDocument: (path, create) =>
        call(() => manager.openDocument(path, create)),
      runTool: (path, name, args) =>
        call(() => manager.runTool(path, name, args)),
      read: (path, format, vendor) =>
        call(() => manager.read(path, format, vendor)),
      save: path => call(() => manager.save(path)),
      undo: path => call(() => manager.undo(path)),
      redo: path => call(() => manager.redo(path)),
      sweep,
      closeAll,
      paths: Effect.sync(() => manager.paths()),
    });
  });

export const layer = (
  options: SessionManagerOptions
): Layer.Layer<SessionManager> => Layer.effect(SessionManager, make(options));
