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

import { authorizePath, realpathOrSelf } from '@/authz';
import { LockFile } from '@/lockFile';
import { choosePipePath, socketFilePaths } from '@/pipePath';
import { serveConnection } from '@/server';
import { HubEnvironment } from '@/services/HubEnvironment';
import { HubDocuments, HubHandlerService, HubHost } from '@/services/HubHost';
import { HubListener } from '@/services/HubListener';
import { warnUnsafe } from '@/services/HubLogger';

export type DocumentHubShape = {
  /**
   * Replaces the documents the lock lists, in one atomic rewrite. Resolves
   * once written and never rejects: a failed write is logged and retried on
   * the next call, so a broken hub never stops an editor from opening.
   */
  readonly setDocuments: (documents: string[]) => Promise<void>;
  /** Deletes the lock, then closes the pipe and deletes the socket; idempotent. */
  readonly close: () => Promise<void>;
  /**
   * Deletes the lock and the socket files before it returns, for a host whose
   * process or page goes down without awaiting close; nothing writes the lock
   * after it. Best effort and idempotent, and close may still follow.
   */
  readonly releaseSync: () => void;
};

export class DocumentHub extends Context.Service<
  DocumentHub,
  DocumentHubShape
>()('@dineug/erd-editor-agent-hub-host/DocumentHub') {}

type Serving = {
  scope: Scope.Closeable;
  pipe: string;
  token: string;
};

/** How long an editor opening waits, once the hub is up, for the lock to list it. */
const PUBLISH_WAIT = '1 second';

/**
 * Serves this window's documents over a per-window pipe that its lock file
 * advertises. Every state change runs on one queue, so the lock on disk always
 * follows the order of the host's enabled, folder and document events.
 */
const make = Effect.gen(function* () {
  const env = yield* HubEnvironment;
  const listener = yield* HubListener;
  const lock = yield* LockFile;
  const handler = yield* HubHandlerService;
  const host = yield* HubHost;
  const documentSource = yield* HubDocuments;
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
  /** Set by releaseSync: the lock is gone and no write may bring it back. */
  let released = false;
  let closing: Promise<void> | null = null;
  let queue = Promise.resolve();
  /** Startup and apply tasks queued or running, the ones that may listen. */
  let listensAhead = 0;
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

  function enqueueListen(task: () => Promise<void>): void {
    listensAhead++;
    void enqueue(task).then(() => {
      listensAhead--;
    });
  }

  /** Every state writes one: hub false, with no pipe, guards the paths of a hub not serving. */
  function lockRecord(): LockRecord {
    return {
      pipe: serving?.pipe ?? '',
      workspaceFolders: folders,
      documents,
      ide: host.ide,
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
          onSuccess: () =>
            released
              ? Effect.succeed(false)
              : lock.write(lockRecord()).pipe(Effect.map(keepUnlessReleased)),
        })
      )
    );

  /**
   * A release that came while the write was on disk ran before its rename
   * could land, so the lock that rename left is deleted again here.
   */
  function keepUnlessReleased(written: boolean): boolean {
    if (!released) return written;
    lock.removeSync();
    return false;
  }

  const realFolders = (): Promise<string[]> =>
    run(Effect.forEach(host.folders(), folder => realpathOrSelf(folder))).then(
      paths => [...paths]
    );

  const serve = (scope: Scope.Closeable, pipe: string, token: string) =>
    Effect.gen(function* () {
      const connections = yield* listener
        .listen(pipe)
        .pipe(Effect.provideService(Scope.Scope, scope));

      yield* connections.pipe(
        Stream.runForEach(socket =>
          serveConnection(
            socket,
            { token, ide: host.ide, version: env.version, handler, authorize },
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
        // A dead process with this pid can have left a socket file here, and so
        // can an earlier hub of this very process, a reload or a re-enable.
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
   * Moves to the state the host asks for. Enabling listens before the lock
   * names the pipe; disabling rewrites the lock before the pipe goes. A hub
   * that fails to serve falls back to hub false, never to no lock at all.
   */
  async function apply(): Promise<void> {
    const want = host.isEnabled();
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

  /**
   * What the host's documents publish through. The write always queues in
   * order; an editor opening waits for it with no listen ahead and for
   * PUBLISH_WAIT at most, so neither a hub coming up nor a stalled task holds it.
   */
  function publish(next: string[]): Promise<void> {
    const written = setDocuments(next);
    if (listensAhead > 0) return Promise.resolve();

    return run(
      Effect.promise(() => written).pipe(
        Effect.timeoutOrElse({
          duration: PUBLISH_WAIT,
          orElse: () =>
            Effect.logWarning(
              `the lock did not list the open documents within ${PUBLISH_WAIT}; the editor opens without waiting for it`
            ),
        })
      )
    );
  }

  function close(): Promise<void> {
    if (!closing) {
      closed = true;
      unsubscribe();
      closing = queue.then(async () => {
        const previous = serving;
        serving = null;
        await run(lock.remove);
        await stopServing(previous);
      });
    }
    return closing;
  }

  function releaseSync(): void {
    if (released) return;
    closed = true;
    released = true;
    unsubscribe();
    lock.removeSync();
    for (const socket of socketFilePaths(
      env.homeDir,
      env.tmpDir,
      env.pid,
      env.platform
    )) {
      env.removeFileSync(socket);
    }
  }

  const subscriptions = [
    host.onEnabledChange(() => enqueueListen(apply)),
    host.onFoldersChange(() => void enqueue(updateFolders)),
  ];
  const unsubscribe = () => subscriptions.splice(0).forEach(end => end());

  enqueueListen(async () => {
    await run(lock.cleanStale);
    folders = await realFolders();
    await apply();
  });

  // The first publish is not awaited: it queues behind the startup task, and
  // holding the acquire open until that ran would bind the pipe and write a
  // lock even for a window disposed in the same tick.
  yield* Effect.sync(() => void documentSource.setPublisher(publish));

  return { setDocuments, close, releaseSync };
});

/** The lock and the pipe go with the runtime, in that order, when the host disposes it. */
export const layer: Layer.Layer<
  DocumentHub,
  never,
  | HubEnvironment
  | HubListener
  | LockFile
  | HubHandlerService
  | HubHost
  | HubDocuments
  | FileSystem.FileSystem
> = Layer.effect(
  DocumentHub,
  Effect.acquireRelease(make, hub => Effect.promise(() => hub.close()))
);
