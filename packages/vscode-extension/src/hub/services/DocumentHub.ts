import {
  HUB_PROTOCOL_VERSION,
  LOCK_DIR_MODE,
  lockDirPath,
  lockFilePath,
  type LockRecord,
} from '@dineug/erd-editor-agent-hub';
import {
  Cause,
  Context,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Scope,
  Stream,
} from 'effect';
import * as vscode from 'vscode';

import { authorizePath, realpathOrSelf } from '@/hub/authz';
import { affectsHubEnabled, isHubEnabled } from '@/hub/config';
import { DocumentRegistryService } from '@/hub/documentRegistry';
import { HubHandlerService } from '@/hub/handlers';
import { LockFile } from '@/hub/lockFile';
import { choosePipePath } from '@/hub/pipePath';
import { serveConnection } from '@/hub/server';
import { HubEnvironment } from '@/hub/services/HubEnvironment';
import { HubListener } from '@/hub/services/HubListener';
import { warnUnsafe } from '@/hub/services/HubLogger';

export type DocumentHubShape = {
  /**
   * Replaces the documents the lock lists, in one atomic rewrite. Resolves
   * once written and never rejects: a failed write is logged and retried on
   * the next call, so a broken hub never stops an editor from opening.
   */
  readonly setDocuments: (documents: string[]) => Promise<void>;
  /** Deletes the lock, then closes the pipe and deletes the socket; idempotent. */
  readonly close: () => Promise<void>;
};

export class DocumentHub extends Context.Service<
  DocumentHub,
  DocumentHubShape
>()('vuerd-vscode/hub/DocumentHub') {}

type Serving = {
  scope: Scope.Closeable;
  pipe: string;
  token: string;
};

const IDE = 'vscode';

/**
 * Serves this window's documents over a per-window pipe that its lock file
 * advertises. Every state change runs on one queue, so the lock on disk always
 * follows the order of trust, setting, folder and document events.
 */
const make = Effect.gen(function* () {
  const env = yield* HubEnvironment;
  const listener = yield* HubListener;
  const lock = yield* LockFile;
  const handler = yield* HubHandlerService;
  const registry = yield* DocumentRegistryService;
  const fs = yield* FileSystem.FileSystem;
  // Every island below runs on this, so its logs reach the same hub logger the
  // layer installed; a bare runPromise would start from an empty context.
  const context = yield* Effect.context<FileSystem.FileSystem>();
  const run = Effect.runPromiseWith(context);

  const lockDir = lockDirPath(env.homeDir);
  const lockPath = lockFilePath(env.homeDir, env.pid);

  let folders: string[] = [];
  let documents: string[] = [];
  let enabled: boolean | null = null;
  let serving: Serving | null = null;
  let closed = false;
  let closing: Promise<void> | null = null;
  let queue = Promise.resolve();
  let nextConnectionId = 1;

  const authorize = (path: string) =>
    authorizePath(env.platform, { folders, documents }, path).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(HubEnvironment, env)
    );

  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue
      .then(() => (closed ? undefined : task()))
      .catch(error => warnUnsafe(error));
    return queue;
  }

  /** Every state writes one: hub false, with no pipe, guards the paths of a hub not serving. */
  function lockRecord(): LockRecord {
    return {
      pipe: serving?.pipe ?? '',
      workspaceFolders: folders,
      documents,
      ide: IDE,
      version: env.version,
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: serving?.token ?? '',
      hub: serving !== null,
    };
  }

  const writeLock = (): Promise<boolean> =>
    run(
      fs.makeDirectory(lockDir, { recursive: true, mode: LOCK_DIR_MODE }).pipe(
        Effect.matchEffect({
          onFailure: error =>
            Effect.logWarning(`could not write ${lockPath}`, error).pipe(
              Effect.as(false)
            ),
          onSuccess: () => lock.write(lockRecord()),
        })
      )
    );

  const realFolders = (): Promise<string[]> => {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    return run(
      Effect.forEach(
        workspaceFolders.filter(folder => folder.uri.scheme === 'file'),
        folder => realpathOrSelf(folder.uri.fsPath)
      )
    ).then(paths => [...paths]);
  };

  const serve = (scope: Scope.Closeable, pipe: string, token: string) =>
    Effect.gen(function* () {
      const connections = yield* listener
        .listen(pipe)
        .pipe(Effect.provideService(Scope.Scope, scope));

      yield* connections.pipe(
        Stream.runForEach(socket =>
          serveConnection(
            socket,
            { token, ide: IDE, version: env.version, handler, authorize },
            () => nextConnectionId++
          ).pipe(Effect.scoped, Effect.forkIn(scope))
        ),
        Effect.forkIn(scope)
      );
    });

  async function listen(): Promise<Serving | null> {
    const pipe = choosePipePath(env.homeDir, env.tmpDir, env.pid, env.platform);
    if (pipe === null) {
      warnUnsafe(
        `neither ${lockDir} nor ${env.tmpDir} leaves room for a socket path`
      );
      return null;
    }
    const token = await run(env.randomToken);
    const scope = await run(Scope.make());
    const started = await run(
      Effect.gen(function* () {
        yield* fs.makeDirectory(lockDir, {
          recursive: true,
          mode: LOCK_DIR_MODE,
        });
        // Only a dead process with this pid can have left a socket file here.
        if (env.platform !== 'win32') {
          yield* fs.remove(pipe).pipe(Effect.ignore);
        }
        yield* serve(scope, pipe, token);
        return true;
      }).pipe(
        Effect.catchCause(cause =>
          Effect.logWarning(
            `could not listen on ${pipe}`,
            Cause.squash(cause)
          ).pipe(Effect.as(false))
        )
      )
    );
    if (!started) {
      await run(Scope.close(scope, Exit.void));
      return null;
    }
    return { scope, pipe, token };
  }

  async function stopServing(target: Serving | null): Promise<void> {
    if (!target) return;

    await run(Scope.close(target.scope, Exit.void));
    if (env.platform !== 'win32') {
      await run(fs.remove(target.pipe).pipe(Effect.ignore));
    }
  }

  /**
   * Moves to the state trust and the setting ask for. Enabling listens before
   * the lock names the pipe; disabling rewrites the lock before the pipe goes.
   * A hub that fails to serve falls back to hub false, never to no lock at all.
   */
  async function apply(): Promise<void> {
    const want = isHubEnabled();
    if (want === enabled && want === (serving !== null)) return;

    enabled = want;
    if (!want) {
      const previous = serving;
      serving = null;
      await writeLock();
      await stopServing(previous);
      return;
    }

    const next = await listen();
    if (next) {
      serving = next;
      if (await writeLock()) return;
      serving = null;
      await stopServing(next);
    }
    await writeLock();
  }

  async function updateFolders(): Promise<void> {
    folders = await realFolders();
    await writeLock();
  }

  function setDocuments(next: string[]): Promise<void> {
    return enqueue(async () => {
      documents = await run(
        Effect.forEach(next, path => realpathOrSelf(path))
      ).then(paths => [...paths]);
      await writeLock();
    });
  }

  function close(): Promise<void> {
    if (!closing) {
      closed = true;
      listeners.forEach(listener => listener.dispose());
      closing = queue.then(async () => {
        const previous = serving;
        serving = null;
        await run(lock.remove);
        await stopServing(previous);
      });
    }
    return closing;
  }

  const listeners = [
    vscode.workspace.onDidGrantWorkspaceTrust(() => enqueue(apply)),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (affectsHubEnabled(event)) enqueue(apply);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => enqueue(updateFolders)),
  ];

  enqueue(async () => {
    await run(lock.cleanStale);
    folders = await realFolders();
    await apply();
  });

  // The first publish is not awaited: it queues behind the startup task, and
  // holding the acquire open until that ran would bind the pipe and write a
  // lock even for a window disposed in the same tick.
  yield* Effect.sync(() => void registry.setPublisher(setDocuments));

  return { setDocuments, close };
});

/** The lock and the pipe go with the runtime, in that order, on deactivate. */
export const layer: Layer.Layer<
  DocumentHub,
  never,
  | HubEnvironment
  | HubListener
  | LockFile
  | HubHandlerService
  | DocumentRegistryService
  | FileSystem.FileSystem
> = Layer.effect(
  DocumentHub,
  Effect.acquireRelease(make, hub => Effect.promise(() => hub.close()))
);
