import {
  type DocumentInfo,
  HubErrorCode,
  HubRequestError,
  isSamePath,
} from '@dineug/erd-editor-agent-hub';
import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { type ErdDocument } from '@/erd-document';
import { realpathOrSelf } from '@/hub/authz';
import { type DocumentRegistry } from '@/hub/documentRegistry';
import { type HubIo, nodeHubIo } from '@/hub/io';
import { warn } from '@/hub/log';
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

function errorCode(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code;
}

function notOpen(message: string): HubRequestError {
  return new HubRequestError(HubErrorCode.notOpen, message);
}

/** Refuses a path the ERD editor does not own, before anything opens, reads or writes it. */
function assertErdFile(path: string): void {
  const name = path.toLowerCase();
  if (ERD_FILE_EXTENSIONS.some(extension => name.endsWith(`.${extension}`))) {
    return;
  }
  throw new HubRequestError(
    HubErrorCode.badRequest,
    `${path} is not an ERD file; the hub serves ${ERD_FILE_EXTENSIONS.map(extension => `.${extension}`).join(', ')} only`
  );
}

/** TextDecoder drops a byte order mark when the editor reads a file; the hub does too. */
function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

/**
 * Serves the hub's requests from the registry. A path in params is already
 * authorized and real, and must name an ERD file. Only openDocument opens an
 * editor, and only openDocument with create writes a file.
 */
export function createDocumentHandler(
  registry: DocumentRegistry,
  io: HubIo = nodeHubIo
): HubHandler {
  const { platform } = registry;

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
  async function orNotFound<T>(path: string, task: Promise<T>): Promise<T> {
    try {
      return await task;
    } catch (error) {
      if (errorCode(error) === 'ENOENT') {
        throw new HubRequestError(
          HubErrorCode.notFound,
          `${path} does not exist`
        );
      }
      throw error;
    }
  }

  /** Writes initialValue only where no file is, with an exclusive create. */
  async function ensureFile(
    path: string,
    create: boolean | undefined,
    initialValue: string | undefined
  ): Promise<void> {
    if (!create) {
      await orNotFound(path, io.stat(path));
      return;
    }
    if (typeof initialValue !== 'string') {
      throw new HubRequestError(
        HubErrorCode.badRequest,
        'openDocument with create needs a string initialValue, the bytes of an empty document'
      );
    }
    try {
      await io.createFile(path, initialValue);
    } catch (error) {
      if (errorCode(error) === 'EEXIST') return;
      if (errorCode(error) === 'ENOENT') {
        throw new HubRequestError(
          HubErrorCode.notFound,
          `The folder of ${path} does not exist`
        );
      }
      throw error;
    }
  }

  async function openEditor(path: string): Promise<void> {
    try {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.file(path),
        VIEW_TYPE,
        { preserveFocus: true, preview: false }
      );
    } catch (error) {
      throw notOpen(
        `VS Code could not open ${path} in the ERD editor: ${error}`
      );
    }
  }

  /**
   * Step 0 measured the first rung to be enough on VS Code 1.138; the others
   * stay for hosts where it is not. Success means the tab is no longer dirty,
   * never that some file was written.
   */
  async function saveThroughEditor(document: ErdDocument): Promise<boolean> {
    try {
      await vscode.workspace.save(document.uri);
    } catch (error) {
      warn(`workspace.save failed for ${document.uri.fsPath}`, error);
    }
    if (!isDirty(document.uri)) return true;

    const panel = registry.panelOf(document);
    if (panel) {
      try {
        panel.reveal();
        await vscode.commands.executeCommand('workbench.action.files.save');
      } catch (error) {
        warn(
          `workbench.action.files.save failed for ${document.uri.fsPath}`,
          error
        );
      }
      if (!isDirty(document.uri)) return true;
    }

    warn(`${document.uri.fsPath} is still dirty after every way to save it`);
    return false;
  }

  return {
    listDocuments: async () => {
      const found = await vscode.workspace.findFiles(
        ERD_FILE_GLOB,
        EXCLUDE_GLOB
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
          path: await realpathOrSelf(io, uri.fsPath),
          open: false,
          active: false,
          dirty: isDirty(uri),
          readonly: false,
        });
      }
      return { documents };
    },

    openDocument: async ({ path, create, initialValue }) => {
      assertErdFile(path);
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
      try {
        await ensureFile(path, create, initialValue);
        await openEditor(path);
      } catch (error) {
        cancel();
        throw error;
      }

      const document = await ready;
      if (!document) {
        throw notOpen(
          `No ERD editor on ${path} reported ready within ${OPEN_READY_TIMEOUT_MS} ms`
        );
      }
      return {
        path,
        opened: true,
        webviews: registry.readyWebviewCount(document),
      };
    },

    join: async ({ path }, connection) => {
      assertErdFile(path);
      const document = registry.find(path);
      if (document) return registry.join(document, connection);

      return {
        initialValue: stripBom(await orNotFound(path, io.readFile(path))),
        snapshotVersion: 0,
        readonly: false,
      };
    },

    applyActions: async ({ path, actions }, connection) => {
      assertErdFile(path);
      const document = registry.find(path);
      if (document && isReadonlyUri(document.uri)) {
        throw new HubRequestError(
          HubErrorCode.readonly,
          `${path} is open only as a read-only view, such as a git revision; openDocument opens the file itself`
        );
      }
      if (!document || registry.readyWebviewCount(document) === 0) {
        throw notOpen(
          `${path} is not open in an ERD editor that is ready; open it with openDocument, then join`
        );
      }
      if (!registry.isJoined(document, connection)) {
        throw notOpen(`Join ${path} before applying actions to it`);
      }

      return {
        webviews: registry.applyPeerActions(document, connection, actions),
      };
    },

    leave: async ({ path }, connection) => {
      registry.leave(path, connection);
      return {};
    },

    save: async ({ path }) => {
      assertErdFile(path);
      const document = registry.find(path);
      if (!document) throw notOpen(`${path} is not open in an ERD editor`);
      if (isReadonlyUri(document.uri)) {
        throw new HubRequestError(
          HubErrorCode.readonly,
          `${path} is open only as a read-only view and cannot be saved; openDocument opens the file itself`
        );
      }

      // An edit reaches document.content only once the replicas save it.
      const settled = await registry.whenQuiet(document, SAVE_QUIET_CAP_MS);
      if (registry.findWritable(path) !== document) {
        throw notOpen(`${path} closed before it could be saved`);
      }
      if (!settled) {
        warn(
          `${path} has an edit no replica saved within ${SAVE_QUIET_CAP_MS} ms; its bytes may lack it, so nothing was saved`
        );
        return { saved: false };
      }
      return { saved: await saveThroughEditor(document) };
    },

    disconnect: connection => registry.disconnect(connection),
  };
}
