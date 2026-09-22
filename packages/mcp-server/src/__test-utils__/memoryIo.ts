import { posix } from 'node:path';

import {
  lockDirPath,
  lockFilePath,
  type LockRecord,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';

import { type DirEntry, type FileStat, type McpIo, type McpSocket } from '@/io';

type File = { data: string; mtimeMs: number; mode: number };

/** The permission bits a file gets when nothing asks for others: 0o666 under a 022 umask. */
export const DEFAULT_MODE = 0o644;

/** The hub end of an in-memory connection, the shape an accepted socket has. */
export type ServerSocket = McpSocket & { destroy: () => void };

export type MemoryIo = McpIo & {
  readonly files: Map<string, File>;
  readonly dirs: Set<string>;
  readonly alive: Set<number>;
  readonly servers: Map<string, (socket: ServerSocket) => void>;
  /** Every path written through writeFile, rename target included. */
  readonly writes: string[];
  /** A hook run before stat answers, so a spec can change a file mid-call. */
  beforeStat: ((path: string) => void) | null;
  /** Writes as another program would; mode applies only to a new file. */
  put: (path: string, data: string, mode?: number) => void;
  read: (path: string) => string;
  writeLock: (pid: number, record: LockRecord, mtimeMs?: number) => void;
  removeLock: (pid: number) => void;
};

export function fsError(code: string, path: string): Error {
  return Object.assign(new Error(`${code}: ${path}`), { code });
}

type End = {
  listeners: Array<(chunk: string) => void>;
  closers: Array<() => void>;
  closed: boolean;
};

/**
 * Two connected sockets over microtasks: bytes arrive after the write returns,
 * as over a pipe, and ending either side closes both after what is in flight.
 */
export function createSocketPair(): [McpSocket, ServerSocket] {
  const a: End = { listeners: [], closers: [], closed: false };
  const b: End = { listeners: [], closers: [], closed: false };
  let pending = 0;
  let closing = false;

  const closeBoth = () => {
    for (const end of [a, b]) {
      if (end.closed) continue;
      end.closed = true;
      end.closers.forEach(fn => fn());
    }
  };

  const make = (self: End, other: End): ServerSocket => ({
    write: data => {
      if (self.closed || closing) return;
      pending++;
      queueMicrotask(() => {
        pending--;
        if (!other.closed) other.listeners.forEach(fn => fn(data));
        if (closing && pending === 0) closeBoth();
      });
    },
    end: () => {
      closing = true;
      if (pending === 0) queueMicrotask(closeBoth);
    },
    destroy: () => {
      closing = true;
      closeBoth();
    },
    onData: fn => {
      self.listeners.push(fn);
    },
    onClose: fn => {
      self.closers.push(fn);
    },
  });

  return [make(a, b), make(b, a)];
}

export type MemoryIoOptions = {
  home?: string;
  cwd?: string;
  platform?: string;
};

/** A file system, lock directory and pipe namespace in memory, POSIX paths only. */
export function createMemoryIo(options: MemoryIoOptions = {}): MemoryIo {
  const home = options.home ?? '/home/agent';
  const files = new Map<string, File>();
  const dirs = new Set<string>(['/']);
  const alive = new Set<number>();
  const servers = new Map<string, (socket: ServerSocket) => void>();
  const writes: string[] = [];
  let clock = 1_000;
  let ids = 0;

  const addDirs = (path: string) => {
    let dir = posix.dirname(path);
    while (!dirs.has(dir)) {
      dirs.add(dir);
      dir = posix.dirname(dir);
    }
  };

  // An existing file keeps its mode, as a write in place does.
  const put = (path: string, data: string, mode = DEFAULT_MODE) => {
    addDirs(path);
    const current = files.get(path);
    files.set(path, { data, mtimeMs: ++clock, mode: current?.mode ?? mode });
  };

  const io: MemoryIo = {
    files,
    dirs,
    alive,
    servers,
    writes,
    beforeStat: null,
    put,
    read: path => {
      const file = files.get(path);
      if (!file) throw fsError('ENOENT', path);
      return file.data;
    },
    writeLock: (pid, record, mtimeMs) => {
      const path = lockFilePath(home, pid);
      addDirs(path);
      files.set(path, {
        data: serializeLock(record),
        mtimeMs: mtimeMs ?? ++clock,
        mode: 0o600,
      });
    },
    removeLock: pid => {
      files.delete(lockFilePath(home, pid));
    },

    homedir: () => home,
    platform: () => options.platform ?? 'linux',
    cwd: () => options.cwd ?? '/work',
    randomId: () => `id${++ids}`,
    readFile: async path => io.read(path),
    writeFile: async (path, data, mode) => {
      if (!dirs.has(posix.dirname(path))) throw fsError('ENOENT', path);
      writes.push(path);
      put(path, data, mode);
    },
    createFile: async (path, data) => {
      if (files.has(path)) throw fsError('EEXIST', path);
      if (!dirs.has(posix.dirname(path))) throw fsError('ENOENT', path);
      put(path, data);
    },
    // A rename moves the file itself: its size, mtime and mode go with it.
    rename: async (from, to) => {
      const file = files.get(from);
      if (!file) throw fsError('ENOENT', from);
      files.delete(from);
      writes.push(to);
      files.set(to, file);
    },
    unlink: async path => {
      if (!files.delete(path)) throw fsError('ENOENT', path);
    },
    stat: async (path): Promise<FileStat> => {
      io.beforeStat?.(path);
      const file = files.get(path);
      if (!file) throw fsError('ENOENT', path);
      return { size: file.data.length, mtimeMs: file.mtimeMs, mode: file.mode };
    },
    readdir: async (path): Promise<DirEntry[]> => {
      if (!dirs.has(path)) throw fsError('ENOENT', path);
      const prefix = path.endsWith('/') ? path : `${path}/`;
      const names = new Map<string, boolean>();
      for (const dir of dirs) {
        const name = dir.slice(prefix.length);
        if (dir.startsWith(prefix) && name !== '' && !name.includes('/')) {
          names.set(dir.slice(prefix.length), true);
        }
      }
      for (const file of files.keys()) {
        if (
          file.startsWith(prefix) &&
          !file.slice(prefix.length).includes('/')
        ) {
          names.set(file.slice(prefix.length), false);
        }
      }
      return Array.from(names, ([name, directory]) => ({ name, directory }));
    },
    realpath: async path => {
      if (files.has(path) || dirs.has(path)) return path;
      throw fsError('ENOENT', path);
    },
    isAlive: pid => alive.has(pid),
    connect: async pipe => {
      const accept = servers.get(pipe);
      if (!accept) throw fsError('ECONNREFUSED', pipe);
      const [client, server] = createSocketPair();
      accept(server);
      return client;
    },
  };

  for (const dir of [lockDirPath(home), options.cwd ?? '/work']) {
    addDirs(posix.join(dir, '.'));
    dirs.add(dir);
  }
  return io;
}
