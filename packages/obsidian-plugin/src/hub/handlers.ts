import {
  type DocumentInfo,
  HubErrorCode,
  HubRequestError,
  isSamePath,
  type JoinResult,
} from '@dineug/erd-editor-agent-hub';
import {
  assertErdFile,
  closedBeforeSave,
  createNeedsInitialValue,
  editorCouldNotOpen,
  erdFileProblem,
  fileMissing,
  folderMissing,
  type HubConnection,
  type HubHandler,
  notJoined,
  notOpenInEditor,
  notReadyForActions,
  OPEN_READY_TIMEOUT_MS,
  openTimedOut,
  realpathOrSelf,
  SAVE_QUIET_CAP_MS,
  stripBom,
  unsettledSave,
} from '@dineug/erd-editor-agent-hub-host';
import type { PlatformError } from 'effect';
import { Effect, FileSystem } from 'effect';

import { type DocumentRegistry, type HubDocument } from '@/hub/registry';
import { type HubTab, type HubVault } from '@/hub/types';

function readonlyView(message: string): HubRequestError {
  return new HubRequestError({ code: HubErrorCode.readonly, message });
}

/** Why an unreadable file refuses an edit: its tabs show it read-only rather than replace it. */
function unreadableFile(path: string): HubRequestError {
  return readonlyView(
    `${path} is open only as a read-only view, since the editor cannot read the file as a diagram; fix the file, then call again`
  );
}

function isNotFound(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === 'NotFound';
}

/**
 * Serves the hub's requests from the registry. A path in params is already
 * authorized and real, and must name an ERD file. Only openDocument opens a
 * tab, and only openDocument with create writes a file.
 */
export function createDocumentHandler<T extends HubTab>(
  registry: DocumentRegistry<T>,
  vault: HubVault,
  fs: FileSystem.FileSystem
): HubHandler {
  const withFs = <A, E>(
    effect: Effect.Effect<A, E, FileSystem.FileSystem>
  ): Effect.Effect<A, E> =>
    Effect.provideService(effect, FileSystem.FileSystem, fs);

  function documentInfo(document: HubDocument<T>, path: string): DocumentInfo {
    return {
      path,
      open: true,
      active: registry.isActive(document),
      dirty: registry.isDirty(document),
      readonly: registry.isReadonly(document),
    };
  }

  /** Answers a missing file with notFound; any other failure is the hub's. */
  const orNotFound = <A>(
    path: string,
    task: Effect.Effect<A, PlatformError.PlatformError>
  ): Effect.Effect<A, HubRequestError> =>
    task.pipe(
      Effect.catch(error =>
        isNotFound(error) ? Effect.fail(fileMissing(path)) : Effect.die(error)
      )
    );

  /** The file as it is on disk, for a document no tab shows. */
  const readFromDisk = (
    path: string
  ): Effect.Effect<JoinResult, HubRequestError> =>
    orNotFound(path, fs.readFileString(path)).pipe(
      Effect.map(text => ({
        initialValue: stripBom(text),
        snapshotVersion: 0,
        readonly: false,
      }))
    );

  /** Creates initialValue only where no file is, through the vault. */
  const ensureFile = (
    path: string,
    create: boolean | undefined,
    initialValue: string | undefined
  ): Effect.Effect<void, HubRequestError> =>
    Effect.gen(function* () {
      if (!create) {
        yield* orNotFound(path, fs.stat(path));
        return;
      }
      if (typeof initialValue !== 'string') {
        return yield* Effect.fail(createNeedsInitialValue());
      }
      const outcome = yield* Effect.promise(() =>
        vault.create(path, initialValue)
      );
      if (outcome === 'noFolder')
        return yield* Effect.fail(folderMissing(path));
    });

  const cannotOpen = (path: string, reason: unknown) =>
    editorCouldNotOpen('Obsidian', path, reason);

  const openTab = (path: string) =>
    Effect.tryPromise({
      try: () => vault.open(path),
      catch: error => cannotOpen(path, error),
    });

  /** The writer's own save; a failure it reports is logged and answers false. */
  const saveThroughTab = (path: string, tab: T) =>
    Effect.gen(function* () {
      const saved = yield* Effect.tryPromise(() => tab.saveDocument()).pipe(
        Effect.catch(error =>
          Effect.logWarning(`saving ${path} failed`, error).pipe(
            Effect.as(false)
          )
        )
      );
      if (!saved) {
        yield* Effect.logWarning(
          `${path} is still unsaved after its tab saved it`
        );
      }
      return saved;
    });

  return {
    listDocuments: () =>
      Effect.gen(function* () {
        const documents: DocumentInfo[] = [];
        const add = (info: DocumentInfo) => {
          if (
            documents.some(({ path }) =>
              isSamePath(path, info.path, registry.platform)
            )
          ) {
            return;
          }
          documents.push(info);
        };

        for (const { document, path } of registry.documents()) {
          add(documentInfo(document, path));
        }
        for (const file of vault.files()) {
          if (erdFileProblem(file)) continue;
          add({
            path: yield* withFs(realpathOrSelf(file)),
            open: false,
            active: false,
            dirty: false,
            readonly: false,
          });
        }
        return { documents };
      }),

    openDocument: ({ path, create, initialValue }) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        // Before the fast path, since a tab still closing after shutdown looks ready.
        if (registry.closed) {
          return yield* Effect.fail(
            cannotOpen(path, 'the ERD Editor plugin is turning off')
          );
        }
        const current = registry.findWritable(path);
        if (current && registry.readyTabCount(current) > 0) {
          return {
            path,
            opened: false,
            webviews: registry.readyTabCount(current),
          };
        }
        const shown = registry.find(path);
        if (shown && registry.isReadonly(shown)) {
          return yield* Effect.fail(unreadableFile(path));
        }

        const { ready, cancel } = registry.waitForReady(
          path,
          OPEN_READY_TIMEOUT_MS
        );
        // onError, not tapError: a failure the hub has no code for dies, and a
        // waiter left registered holds its timer for five seconds.
        yield* ensureFile(path, create, initialValue).pipe(
          Effect.flatMap(() => openTab(path)),
          Effect.onError(() => Effect.sync(cancel))
        );

        const document = yield* ready;
        if (!document) return yield* Effect.fail(openTimedOut(path));
        if (registry.isReadonly(document)) {
          return yield* Effect.fail(unreadableFile(path));
        }
        return {
          path,
          opened: true,
          webviews: registry.readyTabCount(document),
        };
      }),

    join: ({ path }, connection) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        const document = registry.find(path);
        if (document && !registry.closed) {
          return yield* registry.join(document, connection);
        }

        const result = yield* readFromDisk(path);
        if (registry.closed) {
          tellClosed(connection, path);
        } else {
          registry.track(connection, path);
        }
        return result;
      }),

    applyActions: ({ path, actions }, connection) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        const document = registry.find(path);
        if (document && registry.isReadonly(document)) {
          return yield* Effect.fail(unreadableFile(path));
        }
        if (!document || registry.readyTabCount(document) === 0) {
          return yield* Effect.fail(notReadyForActions(path));
        }
        if (!registry.isJoined(document, connection)) {
          return yield* Effect.fail(notJoined(path));
        }

        return {
          webviews: registry.applyPeerActions(document, connection, actions),
        };
      }),

    leave: ({ path }, connection) =>
      Effect.sync(() => {
        registry.leave(path, connection);
        return {};
      }),

    save: ({ path }) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        const document = registry.find(path);
        if (!document) return yield* Effect.fail(notOpenInEditor(path));
        if (registry.isReadonly(document)) {
          return yield* Effect.fail(
            readonlyView(
              `${path} is open only as a read-only view, since the editor cannot read the file as a diagram, and cannot be saved`
            )
          );
        }

        // An edit reaches the content only once the replicas save it.
        const settled = yield* registry.whenQuiet(document, SAVE_QUIET_CAP_MS);
        if (registry.findWritable(path) !== document) {
          return yield* Effect.fail(closedBeforeSave(path));
        }
        if (!settled) {
          yield* Effect.logWarning(unsettledSave(path));
          return { saved: false };
        }
        return {
          saved: yield* saveThroughTab(path, registry.writer(document)),
        };
      }),

    disconnect: connection => registry.disconnect(connection),
  };
}

/**
 * Tells a peer that read a file after shutdown that the editor let go of it,
 * on a timer, so after the join response: a peer answered after the notice
 * would take the answer for a registration and keep waiting on the editor.
 */
function tellClosed(connection: HubConnection, path: string): void {
  setTimeout(() =>
    connection.notify({ method: 'documentClosed', params: { path } })
  );
}
