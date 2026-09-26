import { mkdtemp, rm } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  encodeFrame,
  HUB_PROTOCOL_VERSION,
  type HubNotification,
} from '@dineug/erd-editor-agent-hub';
import {
  fromNetSocket,
  type HubConnection,
  type HubHandler,
  hubLoggerLayer,
  serveConnection,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect, Fiber, FileSystem, Option, PlatformError } from 'effect';
import { type Mock, vi } from 'vite-plus/test';

import { createDocumentHandler } from '@/hub/handlers';
import { DocumentRegistry } from '@/hub/registry';
import {
  type CreateOutcome,
  type HubTab,
  type HubVault,
  type VaultFile,
} from '@/hub/types';

/** Where the fake vault lives on disk; a vault path joins onto it. */
export const VAULT = '/vault';

/** A tab double: what the hub injects lands in received, and saveDocument answers saveResult. */
export class FakeTab implements HubTab {
  readonly received: unknown[][] = [];
  saveResult: boolean | Error = true;
  /** What lastSaved answers, as the text the file held at the tab's last load or save. */
  savedText: string | null = null;
  readonly saveDocument: Mock<() => Promise<boolean>> = vi.fn(async () => {
    if (this.saveResult instanceof Error) throw this.saveResult;
    return this.saveResult;
  });

  receive(actions: unknown[]): void {
    this.received.push(actions);
  }

  lastSaved(): string | null {
    return this.savedText;
  }
}

/** A connection double; every notification it is sent lands in notifications. */
export type MockConnection = HubConnection & {
  notify: Mock<(notification: HubNotification) => void>;
  drain: Mock<() => Promise<void>>;
  notifications: HubNotification[];
};

export function createConnection(id = 1): MockConnection {
  const notifications: HubNotification[] = [];
  return {
    id,
    client: 'spec',
    notify: vi.fn((notification: HubNotification) => {
      notifications.push(notification);
    }),
    drain: vi.fn(() => Promise.resolve()),
    notifications,
  };
}

/** The actions notifications a connection got, as their action arrays. */
export function actionsSent(connection: MockConnection): unknown[][] {
  return connection.notifications
    .filter(notification => notification.method === 'actions')
    .map(
      notification => (notification.params as { actions: unknown[] }).actions
    );
}

/** The paths of the documentClosed notifications a connection got. */
export function closedSent(connection: MockConnection): string[] {
  return connection.notifications
    .filter(notification => notification.method === 'documentClosed')
    .map(notification => notification.params.path);
}

/** Lets a chain of already settled promises run, without touching timers. */
export async function microtasks(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
}

/** The failure a memory fs call answers with, for a spec that makes one fail. */
export function fsError(
  tag: 'NotFound' | 'Busy',
  method: string,
  path: string
): PlatformError.PlatformError {
  return PlatformError.systemError({
    _tag: tag,
    module: 'FileSystem',
    method,
    pathOrDescriptor: path,
  });
}

const fileInfo = (size: number): FileSystem.File.Info => ({
  type: 'File',
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0o644,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: size as unknown as FileSystem.File.Info['size'],
  blksize: Option.none(),
  blocks: Option.none(),
});

export type OpenedTab = { file: VaultFile; tab: FakeTab };

/**
 * A registry and its handler over a memory disk and a vault double. Files are
 * keyed by absolute path; links map a path to the real one, as a symlink or a
 * case the disk spells another way does.
 */
export function createHubHarness() {
  const disk = new Map<string, string>();
  const folders = new Set<string>([VAULT]);
  const links = new Map<string, string>();
  const vaultFiles = new Map<string, VaultFile>();

  const realOf = (path: string) => links.get(path) ?? path;
  const realpath = vi.fn(async (path: string) => realOf(path));

  const registry = new DocumentRegistry<FakeTab>({
    platform: 'linux',
    fullPath: file => `${VAULT}/${file.path}`,
    realpath,
  });

  const fsMock = {
    readFileString: vi.fn((path: string) =>
      Effect.suspend(() => {
        const text = disk.get(realOf(path));
        return text === undefined
          ? Effect.fail(fsError('NotFound', 'readFileString', path))
          : Effect.succeed(text);
      })
    ),
    stat: vi.fn((path: string) =>
      Effect.suspend(() => {
        const text = disk.get(realOf(path));
        return text === undefined
          ? Effect.fail(fsError('NotFound', 'stat', path))
          : Effect.succeed(fileInfo(text.length));
      })
    ),
    realPath: vi.fn((path: string) => Effect.succeed(realOf(path))),
  };
  const fs = FileSystem.makeNoop(
    fsMock as unknown as Partial<FileSystem.FileSystem>
  );

  /** What vault.open does to a path; by default it opens a ready tab on it. */
  let onOpen: (path: string) => Promise<void> = async path => {
    const vaultPath = path.slice(VAULT.length + 1);
    void openReady(vaultPath, disk.get(path) ?? '');
  };

  const vault = {
    files: vi.fn((): readonly string[] =>
      Array.from(vaultFiles.keys(), path => `${VAULT}/${path}`)
    ),
    create: vi.fn(
      async (path: string, data: string): Promise<CreateOutcome> => {
        const folder = path.slice(0, path.lastIndexOf('/'));
        if (!folders.has(folder)) return 'noFolder';
        if (disk.has(path)) return 'exists';
        addFile(path.slice(VAULT.length + 1), data);
        return 'created';
      }
    ),
    open: vi.fn((path: string) => onOpen(path)),
  } satisfies HubVault;

  const handler = createDocumentHandler(registry, vault, fs);

  /** A file of the vault, on disk under VAULT. */
  function addFile(vaultPath: string, text = '{}'): VaultFile {
    const file = vaultFiles.get(vaultPath) ?? { path: vaultPath };
    vaultFiles.set(vaultPath, file);
    disk.set(`${VAULT}/${vaultPath}`, text);
    return file;
  }

  /** A tab joining a file and loading it, as ErdView does in setViewData; not ready yet. */
  function addTab(vaultPath: string, text?: string): OpenedTab {
    const file = vaultFiles.get(vaultPath) ?? addFile(vaultPath, text);
    const tab = new FakeTab();
    const loaded = text ?? disk.get(`${VAULT}/${vaultPath}`) ?? '';
    tab.savedText = loaded;
    registry.addTab(file, tab);
    registry.loaded(tab, loaded, false);
    return { file, tab };
  }

  /** A tab whose shared store is open on a readable document, once its path resolved. */
  async function openReady(
    vaultPath: string,
    text?: string
  ): Promise<OpenedTab> {
    const opened = addTab(vaultPath, text);
    registry.setTabState(opened.tab, { live: true, unreadable: false });
    await microtasks();
    return opened;
  }

  /** A tab on a file the editor cannot read, which opens read-only. */
  async function openUnreadable(
    vaultPath: string,
    text = 'not json'
  ): Promise<OpenedTab> {
    const opened = addTab(vaultPath, text);
    registry.setTabState(opened.tab, { live: false, unreadable: true });
    await microtasks();
    return opened;
  }

  return {
    registry,
    handler,
    vault,
    fs: fsMock,
    disk,
    folders,
    links,
    realpath,
    addFile,
    addTab,
    openReady,
    openUnreadable,
    /** Replaces what vault.open does. */
    setOpen: (open: (path: string) => Promise<void>) => {
      onOpen = open;
    },
    /** A relay from the tab's shared store. */
    relay: ({ tab }: OpenedTab, actions: unknown) =>
      registry.relay(tab, actions),
    /** The tab's replica saved value. */
    save: ({ tab }: OpenedTab, value: string) =>
      registry.valueSaved(tab, value),
    /** Runs one of the handler's effects under the hub's logger, as its runtime does. */
    run: <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
      Effect.runPromise(Effect.provide(effect, hubLoggerLayer)),
  };
}

export type HubHarness = ReturnType<typeof createHubHarness>;

/** A peer on a real socket, served by the shipping serveConnection. */
export type SocketPeer = {
  /** Every frame the hub wrote, parsed, in order; the hello response first. */
  readonly received: unknown[];
  send: (message: unknown) => void;
  /** Resolves once the hub has written count frames, or rejects after a second. */
  receivedAtLeast: (count: number) => Promise<void>;
  close: () => Promise<void>;
};

/**
 * Serves handler on a socket in a temporary folder, as the hub serves a coding
 * agent, and connects one peer that has said hello. What the peer reads is the
 * order the frames went out in.
 */
export async function servePeer(handler: HubHandler): Promise<SocketPeer> {
  const dir = await mkdtemp(join(tmpdir(), 'erd-obsidian-hub-'));
  const pipe = join(dir, 'hub.sock');
  const fibers: Array<Fiber.Fiber<unknown, unknown>> = [];
  const server = createServer(socket => {
    const serve = serveConnection(
      fromNetSocket(socket),
      {
        token: 'token',
        ide: 'obsidian',
        version: '0.0.0',
        handler,
        authorize: path => Effect.succeed(path),
      },
      () => 1
    );
    fibers.push(
      Effect.runFork(serve.pipe(Effect.scoped, Effect.provide(hubLoggerLayer)))
    );
  });
  await new Promise<void>(resolve => void server.listen(pipe, resolve));

  const client = connect(pipe);
  client.setEncoding('utf8');
  const received: unknown[] = [];
  let pending = '';
  client.on('data', (chunk: string) => {
    pending += chunk;
    for (let end = pending.indexOf('\n'); end !== -1;) {
      received.push(JSON.parse(pending.slice(0, end)));
      pending = pending.slice(end + 1);
      end = pending.indexOf('\n');
    }
  });
  await new Promise(resolve => client.once('connect', resolve));

  const receivedAtLeast = async (count: number) => {
    for (let waited = 0; received.length < count; waited += 5) {
      if (waited >= 1_000) {
        throw new Error(`the hub wrote ${received.length} of ${count} frames`);
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };
  const send = (message: unknown) => void client.write(encodeFrame(message));

  send({
    id: 1,
    method: 'hello',
    params: {
      token: 'token',
      protocolVersion: HUB_PROTOCOL_VERSION,
      client: 'spec',
    },
  });
  await receivedAtLeast(1);

  return {
    received,
    send,
    receivedAtLeast,
    close: async () => {
      client.destroy();
      await Promise.all(
        fibers.map(fiber => Effect.runPromise(Fiber.interrupt(fiber)))
      );
      await new Promise(resolve => server.close(resolve));
      await rm(dir, { recursive: true, force: true });
    },
  };
}
