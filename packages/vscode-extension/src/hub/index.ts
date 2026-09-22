import {
  HUB_PROTOCOL_VERSION,
  LOCK_DIR_MODE,
  lockDirPath,
  lockFilePath,
  type LockRecord,
} from '@dineug/erd-editor-agent-hub';
import * as vscode from 'vscode';

import { authorizePath, realpathOrSelf } from '@/hub/authz';
import { affectsHubEnabled, isHubEnabled } from '@/hub/config';
import { type HubIo, type HubServerHandle, nodeHubIo } from '@/hub/io';
import {
  cleanStaleLocks,
  removeLockFile,
  unlinkQuietly,
  writeLockFile,
} from '@/hub/lockFile';
import { warn } from '@/hub/log';
import { choosePipePath } from '@/hub/pipePath';
import { createHubServer, type HubHandler, type HubServer } from '@/hub/server';

export type { HubConnection, HubHandler } from '@/hub/server';

export type DocumentHub = vscode.Disposable & {
  /**
   * Replaces the documents the lock lists, in one atomic rewrite. Resolves
   * once written and never rejects: a failed write is logged and retried on
   * the next call, so a broken hub never stops an editor from opening.
   */
  setDocuments: (documents: string[]) => Promise<void>;
  /** Deletes the lock, then closes the pipe and deletes the socket; idempotent. */
  close: () => Promise<void>;
};

type Serving = {
  server: HubServer;
  handle: HubServerHandle;
  pipe: string;
  token: string;
};

const IDE = 'vscode';

/**
 * Serves this window's documents over a per-window pipe that its lock file
 * advertises. Every state change runs on one queue, so the lock on disk always
 * follows the order of trust, setting, folder and document events.
 */
export function startDocumentHub(
  context: vscode.ExtensionContext,
  handler: HubHandler,
  io: HubIo = nodeHubIo
): DocumentHub {
  const platform = io.platform();
  const pid = io.pid();
  const homeDir = io.homedir();
  const tmpDir = io.tmpdir();
  const lockDir = lockDirPath(homeDir);
  const lockPath = lockFilePath(homeDir, pid);
  const version: string = context.extension.packageJSON.version;

  let folders: string[] = [];
  let documents: string[] = [];
  let enabled: boolean | null = null;
  let serving: Serving | null = null;
  let closed = false;
  let closing: Promise<void> | null = null;
  let queue = Promise.resolve();

  const authorize = (path: string) =>
    authorizePath(io, platform, { folders, documents }, path);

  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(() => (closed ? undefined : task())).catch(warn);
    return queue;
  }

  /** Every state writes one: hub false, with no pipe, guards the paths of a hub not serving. */
  function lockRecord(): LockRecord {
    return {
      pipe: serving?.pipe ?? '',
      workspaceFolders: folders,
      documents,
      ide: IDE,
      version,
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: serving?.token ?? '',
      hub: serving !== null,
    };
  }

  async function writeLock(): Promise<boolean> {
    try {
      await io.mkdir(lockDir, LOCK_DIR_MODE);
      await writeLockFile(io, lockPath, lockRecord());
      return true;
    } catch (error) {
      warn(`could not write ${lockPath}`, error);
      return false;
    }
  }

  async function realFolders(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    return Promise.all(
      workspaceFolders
        .filter(folder => folder.uri.scheme === 'file')
        .map(folder => realpathOrSelf(io, folder.uri.fsPath))
    );
  }

  async function listen(): Promise<Serving | null> {
    const pipe = choosePipePath(homeDir, tmpDir, pid, platform);
    if (pipe === null) {
      warn(`neither ${lockDir} nor ${tmpDir} leaves room for a socket path`);
      return null;
    }

    const token = io.randomToken();
    const server = createHubServer({
      token,
      ide: IDE,
      version,
      handler,
      authorize,
    });
    try {
      await io.mkdir(lockDir, LOCK_DIR_MODE);
      // Only a dead process with this pid can have left a socket file here.
      if (platform !== 'win32') await unlinkQuietly(io, pipe);
      const handle = await io.listen(pipe, socket => server.accept(socket));
      return { server, handle, pipe, token };
    } catch (error) {
      warn(`could not listen on ${pipe}`, error);
      return null;
    }
  }

  async function stopServing(target: Serving | null): Promise<void> {
    if (!target) return;

    target.server.close();
    await target.handle.close();
    if (platform !== 'win32') await unlinkQuietly(io, target.pipe);
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
      documents = await Promise.all(next.map(path => realpathOrSelf(io, path)));
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
        await removeLockFile(io, lockPath);
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
    await cleanStaleLocks(io, homeDir, tmpDir, pid, platform);
    folders = await realFolders();
    await apply();
  });

  return {
    setDocuments,
    close,
    dispose: () => {
      close();
    },
  };
}
