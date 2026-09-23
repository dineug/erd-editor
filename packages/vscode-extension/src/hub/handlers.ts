import {
  type DocumentInfo,
  HubErrorCode,
  HubRequestError,
  isSamePath,
} from '@dineug/erd-editor-agent-hub';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';
import type * as PlatformError from 'effect/PlatformError';
import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { type ErdDocument } from '@/erd-document';
import { realpathOrSelf } from '@/hub/authz';
import {
  type DocumentRegistry,
  DocumentRegistryService,
} from '@/hub/documentRegistry';
import { isReadonlyUri } from '@/hub/readonlyUri';
import { type HubHandler } from '@/hub/server';

/** The file extensions of the custom editor selector, which a test holds this to. */
export const ERD_FILE_EXTENSIONS: readonly string[] = [
  'erd',
  'vuerd',
  'erd.json',
  'vuerd.json',
];

/** The activation glob of package.json, which a test holds this to. */
export const ERD_FILE_GLOB = `**/*.{${ERD_FILE_EXTENSIONS.join(',')}}`;

const EXCLUDE_GLOB = '**/node_modules/**';

/**
 * How long openDocument waits for the first webview to report ready. It loads
 * html and parses the bundle, far slower than a replica save.
 */
export const OPEN_READY_TIMEOUT_MS = 5_000;

/**
 * How long save waits for the replicas to hold every edit before it gives up
 * with saved false. Longer than the join cap, since the caller asked for the
 * edit on disk and saving without it would be a silent loss.
 */
export const SAVE_QUIET_CAP_MS = 2_000;

/** The hub's request half, so the connection server needs no vscode of its own. */
export class HubHandlerService extends Context.Service<
  HubHandlerService,
  HubHandler
>()('vuerd-vscode/hub/HubHandler') {}

function notOpen(message: string): HubRequestError {
  return new HubRequestError({ code: HubErrorCode.notOpen, message });
}

function isNotFound(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === 'NotFound';
}

function isAlreadyExists(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === 'AlreadyExists';
}

/** Refuses a path the ERD editor does not own, before anything opens, reads or writes it. */
function erdFileProblem(path: string): HubRequestError | null {
  const name = path.toLowerCase();
  if (ERD_FILE_EXTENSIONS.some(extension => name.endsWith(`.${extension}`))) {
    return null;
  }
  return new HubRequestError({
    code: HubErrorCode.badRequest,
    message: `${path} is not an ERD file; the hub serves ${ERD_FILE_EXTENSIONS.map(extension => `.${extension}`).join(', ')} only`,
  });
}

const assertErdFile = (path: string) => {
  const problem = erdFileProblem(path);
  return problem ? Effect.fail(problem) : Effect.void;
};

/** TextDecoder drops a byte order mark when the editor reads a file; the hub does too. */
function stripBom(text: string): string {
  return text.startsWith('﻿') ? text.slice(1) : text;
}

/**
 * Serves the hub's requests from the registry. A path in params is already
 * authorized and real, and must name an ERD file. Only openDocument opens an
 * editor, and only openDocument with create writes a file.
 */
export const make = Effect.fn('createDocumentHandler')(function* () {
  const registry = yield* DocumentRegistryService;
  const fs = yield* FileSystem.FileSystem;

  return createDocumentHandler(registry, fs);
});

export function createDocumentHandler(
  registry: DocumentRegistry,
  fs: FileSystem.FileSystem
): HubHandler {
  const { platform } = registry;
  const withFs = <A, E>(
    effect: Effect.Effect<A, E, FileSystem.FileSystem>
  ): Effect.Effect<A, E> =>
    Effect.provideService(effect, FileSystem.FileSystem, fs);

  const sameUri = (a: vscode.Uri, b: vscode.Uri) =>
    a.scheme === b.scheme && isSamePath(a.fsPath, b.fsPath, platform);

  function editorTabs(uri: vscode.Uri): vscode.Tab[] {
    return vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .filter(
        tab =>
          tab.input instanceof vscode.TabInputCustom &&
          tab.input.viewType === VIEW_TYPE &&
          sameUri(tab.input.uri, uri)
      );
  }

  const isDirty = (uri: vscode.Uri) => editorTabs(uri).some(tab => tab.isDirty);

  function documentInfo(document: ErdDocument, path: string): DocumentInfo {
    return {
      path,
      open: true,
      active: registry.isActive(document),
      dirty: isDirty(document.uri),
      readonly: isReadonlyUri(document.uri),
    };
  }

  /** Answers a missing file with notFound; any other failure is the hub's. */
  const orNotFound = <A>(
    path: string,
    task: Effect.Effect<A, PlatformError.PlatformError>
  ): Effect.Effect<A, HubRequestError> =>
    task.pipe(
      Effect.catch(error =>
        isNotFound(error)
          ? Effect.fail(
              new HubRequestError({
                code: HubErrorCode.notFound,
                message: `${path} does not exist`,
              })
            )
          : Effect.die(error)
      )
    );

  /** Writes initialValue only where no file is, with an exclusive create. */
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
        return yield* Effect.fail(
          new HubRequestError({
            code: HubErrorCode.badRequest,
            message:
              'openDocument with create needs a string initialValue, the bytes of an empty document',
          })
        );
      }
      yield* fs.writeFileString(path, initialValue, { flag: 'wx' }).pipe(
        Effect.catch(error => {
          if (isAlreadyExists(error)) return Effect.void;
          if (isNotFound(error)) {
            return Effect.fail(
              new HubRequestError({
                code: HubErrorCode.notFound,
                message: `The folder of ${path} does not exist`,
              })
            );
          }
          return Effect.die(error);
        })
      );
    });

  const openEditor = (path: string) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          vscode.commands.executeCommand(
            'vscode.openWith',
            vscode.Uri.file(path),
            VIEW_TYPE,
            { preserveFocus: true, preview: false }
          )
        ),
      catch: error =>
        notOpen(`VS Code could not open ${path} in the ERD editor: ${error}`),
    }).pipe(Effect.asVoid);

  /**
   * On VS Code 1.138 workspace.save alone clears the dirty flag (AGENTS.md);
   * the second rung, the panel's save command, is for hosts where it does not.
   * Success means the tab is no longer dirty, never that some file was written.
   */
  const saveThroughEditor = (document: ErdDocument) =>
    Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () => Promise.resolve(vscode.workspace.save(document.uri)),
        catch: error => error,
      }).pipe(
        Effect.catch(error =>
          Effect.logWarning(
            `workspace.save failed for ${document.uri.fsPath}`,
            error
          )
        )
      );
      if (!isDirty(document.uri)) return true;

      const panel = registry.panelOf(document);
      if (panel) {
        yield* Effect.tryPromise({
          try: () => {
            panel.reveal();
            return Promise.resolve(
              vscode.commands.executeCommand('workbench.action.files.save')
            );
          },
          catch: error => error,
        }).pipe(
          Effect.catch(error =>
            Effect.logWarning(
              `workbench.action.files.save failed for ${document.uri.fsPath}`,
              error
            )
          )
        );
        if (!isDirty(document.uri)) return true;
      }

      yield* Effect.logWarning(
        `${document.uri.fsPath} is still dirty after every way to save it`
      );
      return false;
    });

  return {
    listDocuments: () =>
      Effect.gen(function* () {
        const found = yield* Effect.promise(() =>
          Promise.resolve(
            vscode.workspace.findFiles(ERD_FILE_GLOB, EXCLUDE_GLOB)
          )
        );
        const documents: DocumentInfo[] = [];
        const add = (info: DocumentInfo) => {
          if (
            documents.some(({ path }) => isSamePath(path, info.path, platform))
          ) {
            return;
          }
          documents.push(info);
        };

        for (const { document, path } of registry.documents()) {
          add(documentInfo(document, path));
        }
        for (const uri of found) {
          add({
            path: yield* withFs(realpathOrSelf(uri.fsPath)),
            open: false,
            active: false,
            dirty: isDirty(uri),
            readonly: false,
          });
        }
        return { documents };
      }),

    openDocument: ({ path, create, initialValue }) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        const current = registry.findWritable(path);
        if (current && registry.readyWebviewCount(current) > 0) {
          return {
            path,
            opened: false,
            webviews: registry.readyWebviewCount(current),
          };
        }

        const { ready, cancel } = registry.waitForReady(
          path,
          OPEN_READY_TIMEOUT_MS
        );
        // onError, not tapError: a file system errno the hub has no code for
        // dies, and a waiter left registered holds its timer for five seconds.
        yield* ensureFile(path, create, initialValue).pipe(
          Effect.flatMap(() => openEditor(path)),
          Effect.onError(() => Effect.sync(cancel))
        );

        const document = yield* ready;
        if (!document) {
          return yield* Effect.fail(
            notOpen(
              `No ERD editor on ${path} reported ready within ${OPEN_READY_TIMEOUT_MS} ms`
            )
          );
        }
        return {
          path,
          opened: true,
          webviews: registry.readyWebviewCount(document),
        };
      }),

    join: ({ path }, connection) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        const document = registry.find(path);
        if (document) return yield* registry.join(document, connection);

        return {
          initialValue: stripBom(
            yield* orNotFound(path, fs.readFileString(path))
          ),
          snapshotVersion: 0,
          readonly: false,
        };
      }),

    applyActions: ({ path, actions }, connection) =>
      Effect.gen(function* () {
        yield* assertErdFile(path);
        const document = registry.find(path);
        if (document && isReadonlyUri(document.uri)) {
          return yield* Effect.fail(
            new HubRequestError({
              code: HubErrorCode.readonly,
              message: `${path} is open only as a read-only view, such as a git revision; openDocument opens the file itself`,
            })
          );
        }
        if (!document || registry.readyWebviewCount(document) === 0) {
          return yield* Effect.fail(
            notOpen(
              `${path} is not open in an ERD editor that is ready; open it with openDocument, then join`
            )
          );
        }
        if (!registry.isJoined(document, connection)) {
          return yield* Effect.fail(
            notOpen(`Join ${path} before applying actions to it`)
          );
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
        if (!document) {
          return yield* Effect.fail(
            notOpen(`${path} is not open in an ERD editor`)
          );
        }
        if (isReadonlyUri(document.uri)) {
          return yield* Effect.fail(
            new HubRequestError({
              code: HubErrorCode.readonly,
              message: `${path} is open only as a read-only view and cannot be saved; openDocument opens the file itself`,
            })
          );
        }

        // An edit reaches document.content only once the replicas save it.
        const settled = yield* registry.whenQuiet(document, SAVE_QUIET_CAP_MS);
        if (registry.findWritable(path) !== document) {
          return yield* Effect.fail(
            notOpen(`${path} closed before it could be saved`)
          );
        }
        if (!settled) {
          yield* Effect.logWarning(
            `${path} has an edit no replica saved within ${SAVE_QUIET_CAP_MS} ms; its bytes may lack it, so nothing was saved`
          );
          return { saved: false };
        }
        return { saved: yield* saveThroughEditor(document) };
      }),

    disconnect: connection => registry.disconnect(connection),
  };
}

export const layer: Layer.Layer<
  HubHandlerService,
  never,
  DocumentRegistryService | FileSystem.FileSystem
> = Layer.effect(HubHandlerService, make());
