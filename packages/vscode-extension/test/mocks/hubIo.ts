import {
  createFrameDecoder,
  encodeFrame,
  HUB_PROTOCOL_VERSION,
  lockFilePath,
  type LockRecord,
} from '@dineug/erd-editor-agent-hub';
import { type Mock, vi } from 'vite-plus/test';

import { type HubIo, type HubSocket } from '@/hub/io';
import { type HubHandler } from '@/hub/server';

/** A handler double whose every member is a vi.fn answering a plausible result. */
export function createHubHandler() {
  return {
    listDocuments: vi.fn<HubHandler['listDocuments']>(async () => ({
      documents: [],
    })),
    openDocument: vi.fn<HubHandler['openDocument']>(async ({ path }) => ({
      path,
      opened: true,
      webviews: 1,
    })),
    join: vi.fn<HubHandler['join']>(async () => ({
      initialValue: '{}',
      snapshotVersion: 0,
      readonly: false,
    })),
    applyActions: vi.fn<HubHandler['applyActions']>(async () => ({
      webviews: 1,
    })),
    leave: vi.fn<HubHandler['leave']>(async () => ({})),
    save: vi.fn<HubHandler['save']>(async () => ({ saved: true })),
    disconnect: vi.fn<HubHandler['disconnect']>(),
  } satisfies HubHandler;
}

export type MockHubHandler = ReturnType<typeof createHubHandler>;

/** The hello frame a current client sends, with overrides for the failure cases. */
export function helloFrame(
  token: string,
  params: Record<string, unknown> = {},
  id = 1
) {
  return {
    id,
    method: 'hello',
    params: {
      token,
      protocolVersion: HUB_PROTOCOL_VERSION,
      client: 'spec',
      ...params,
    },
  };
}

/** Lets every settled promise run its callbacks; the memory double never waits on I/O. */
export const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/** The peer's end of a memory connection. */
export type MemoryClient = {
  /** Encodes message as one frame and hands it to the hub. */
  send: (message: unknown) => void;
  /** Hands the hub raw text, for split or malformed frames. */
  sendRaw: (chunk: string) => void;
  /** Every frame the hub wrote, parsed, in order. */
  readonly received: unknown[];
  readonly closed: boolean;
  /** Hangs up from the peer's side. */
  close: () => void;
};

export type MemorySocket = HubSocket & {
  write: Mock<(data: string) => void>;
  end: Mock<() => void>;
  destroy: Mock<() => void>;
};

/** A connected pair: socket is what the hub accepts, client is the peer. */
export function createMemorySocketPair(): {
  socket: MemorySocket;
  client: MemoryClient;
} {
  const dataListeners: Array<(chunk: string) => void> = [];
  const closeListeners: Array<() => void> = [];
  const received: unknown[] = [];
  const decoder = createFrameDecoder();
  let closed = false;

  const hangUp = () => {
    if (closed) return;
    closed = true;
    for (const listener of closeListeners) listener();
  };

  const socket: MemorySocket = {
    write: vi.fn((data: string) => {
      if (!closed) received.push(...decoder.push(data));
    }),
    end: vi.fn(hangUp),
    destroy: vi.fn(hangUp),
    onData: listener => {
      dataListeners.push(listener);
    },
    onClose: listener => {
      closeListeners.push(listener);
    },
  };

  const client: MemoryClient = {
    send: message => client.sendRaw(encodeFrame(message)),
    sendRaw: chunk => {
      if (closed) return;
      for (const listener of dataListeners) listener(chunk);
    },
    received,
    get closed() {
      return closed;
    },
    close: hangUp,
  };

  return { socket, client };
}

type MemoryFile = { data: string; mode: number; socket: boolean };

function fsError(code: string, path: string): Error {
  return Object.assign(new Error(`${code}: ${path}`), { code });
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export type MemoryHubIoOptions = {
  homedir?: string;
  tmpdir?: string;
  platform?: string;
  pid?: number;
};

/**
 * A HubIo over maps, POSIX-style paths only. Every member is a vi.fn, so a
 * spec can make one call fail with mockRejectedValueOnce. Modes follow fs:
 * mkdir and writeFile apply theirs only to what they create.
 */
export function createMemoryHubIo(options: MemoryHubIoOptions = {}) {
  const files = new Map<string, MemoryFile>();
  const dirs = new Map<string, number>([['/', 0o755]]);
  /** Symlinks: a path starting with a key resolves under its value. */
  const links = new Map<string, string>();
  const alive = new Set<number>();
  const servers = new Map<string, (socket: HubSocket) => void>();
  const pid = options.pid ?? 4242;
  let tokens = 0;

  alive.add(pid);

  const addDir = (path: string, mode = 0o755) => {
    if (dirs.has(path)) return;
    if (path !== '/') addDir(parentOf(path), mode);
    dirs.set(path, mode);
  };

  const resolveLinks = (path: string) => {
    for (const [from, to] of links) {
      if (path === from || path.startsWith(`${from}/`)) {
        return to + path.slice(from.length);
      }
    }
    return path;
  };

  const io = {
    homedir: vi.fn(() => options.homedir ?? '/home/user'),
    tmpdir: vi.fn(() => options.tmpdir ?? '/tmp'),
    platform: vi.fn(() => options.platform ?? 'linux'),
    pid: vi.fn(() => pid),
    randomToken: vi.fn(() => `token-${++tokens}`),
    mkdir: vi.fn(async (path: string, mode: number) => addDir(path, mode)),
    writeFile: vi.fn(async (path: string, data: string, mode: number) => {
      if (!dirs.has(parentOf(path))) throw fsError('ENOENT', path);
      const existing = files.get(path);
      files.set(path, { data, mode: existing?.mode ?? mode, socket: false });
    }),
    createFile: vi.fn(async (path: string, data: string) => {
      if (!dirs.has(parentOf(path))) throw fsError('ENOENT', path);
      if (files.has(path) || dirs.has(path)) throw fsError('EEXIST', path);
      files.set(path, { data, mode: 0o644, socket: false });
    }),
    readFile: vi.fn(async (path: string) => {
      const file = files.get(path);
      if (!file) throw fsError('ENOENT', path);
      return file.data;
    }),
    readdir: vi.fn(async (path: string) => {
      if (!dirs.has(path)) throw fsError('ENOENT', path);
      return [...files.keys()]
        .filter(file => parentOf(file) === path)
        .map(baseName);
    }),
    stat: vi.fn(async (path: string) => {
      if (!files.has(path)) throw fsError('ENOENT', path);
      return { mtimeMs: 1 };
    }),
    /** A link key is an entry even when its target is missing, as a dangling symlink is. */
    lstat: vi.fn(async (path: string) => {
      if (links.has(path)) return {};
      const resolved = resolveLinks(path);
      if (!files.has(resolved) && !dirs.has(resolved)) {
        throw fsError('ENOENT', path);
      }
      return {};
    }),
    unlink: vi.fn(async (path: string) => {
      if (!files.delete(path)) throw fsError('ENOENT', path);
    }),
    rename: vi.fn(async (from: string, to: string) => {
      const file = files.get(from);
      if (!file) throw fsError('ENOENT', from);
      files.delete(from);
      files.set(to, file);
    }),
    realpath: vi.fn(async (path: string) => {
      const resolved = resolveLinks(path);
      if (!files.has(resolved) && !dirs.has(resolved)) {
        throw fsError('ENOENT', path);
      }
      return resolved;
    }),
    isAlive: vi.fn((target: number) => alive.has(target)),
    listen: vi.fn(
      async (pipe: string, onConnection: (socket: HubSocket) => void) => {
        if (servers.has(pipe) || files.has(pipe)) {
          throw fsError('EADDRINUSE', pipe);
        }
        if (!pipe.startsWith('\\\\.\\pipe\\')) {
          if (!dirs.has(parentOf(pipe))) throw fsError('ENOENT', pipe);
          files.set(pipe, { data: '', mode: 0o755, socket: true });
        }
        servers.set(pipe, onConnection);
        return {
          close: vi.fn(async () => {
            servers.delete(pipe);
          }),
        };
      }
    ),
  } satisfies HubIo;

  return Object.assign(io, {
    files,
    dirs,
    links,
    alive,
    servers,
    /** Adds a file and every missing parent directory. */
    addFile: (path: string, data = '') => {
      addDir(parentOf(path));
      files.set(path, { data, mode: 0o644, socket: false });
    },
    addDir,
    /** Parses the JSON file at path, or undefined when there is none. */
    readJson: (path: string): any => {
      const file = files.get(path);
      return file ? JSON.parse(file.data) : undefined;
    },
    /** The path of this window's lock file. */
    lockPath: () => lockFilePath(options.homedir ?? '/home/user', pid),
    /** This window's lock record, or undefined when it has none. */
    lock: (): LockRecord | undefined => {
      const file = files.get(
        lockFilePath(options.homedir ?? '/home/user', pid)
      );
      return file ? JSON.parse(file.data) : undefined;
    },
    /** Opens a connection to the server listening on pipe. */
    connect: (pipe: string): MemoryClient => {
      const onConnection = servers.get(pipe);
      if (!onConnection) throw fsError('ECONNREFUSED', pipe);
      const { socket, client } = createMemorySocketPair();
      onConnection(socket);
      return client;
    },
  });
}

/**
 * Connects to the pipe this window's lock names and sends a hello with its
 * token. The hello response is the first frame of client.received.
 */
export function connectToLock(io: MemoryHubIo): MemoryClient {
  const lock = io.lock();
  if (!lock?.hub) throw new Error('this window serves no hub');

  const client = io.connect(lock.pipe);
  client.send(helloFrame(lock.token));
  return client;
}

export type MemoryHubIo = ReturnType<typeof createMemoryHubIo>;
