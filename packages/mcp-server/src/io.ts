import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { connect as netConnect } from 'node:net';
import { homedir } from 'node:os';

/** One connection to a hub, decoded to text with a streaming UTF-8 decoder. */
export type McpSocket = {
  write: (data: string) => void;
  end: () => void;
  onData: (listener: (chunk: string) => void) => void;
  onClose: (listener: () => void) => void;
};

/** Size and mtime tell a change; mode is the permission bits alone. */
export type FileStat = { size: number; mtimeMs: number; mode: number };

export type DirEntry = { name: string; directory: boolean };

/**
 * Every net, fs and process call the server makes. The modules see only this
 * type, so the unit suite swaps in a memory double; nodeIo is the one real
 * binding.
 */
export type McpIo = {
  homedir: () => string;
  platform: () => string;
  cwd: () => string;
  randomId: () => string;
  readFile: (path: string) => Promise<string>;
  /** Mode sets the permission bits of a file it creates, under the umask. */
  writeFile: (path: string, data: string, mode?: number) => Promise<void>;
  /** Exclusive: rejects with EEXIST rather than replace a file that is already there. */
  createFile: (path: string, data: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  unlink: (path: string) => Promise<void>;
  stat: (path: string) => Promise<FileStat>;
  readdir: (path: string) => Promise<DirEntry[]>;
  realpath: (path: string) => Promise<string>;
  isAlive: (pid: number) => boolean;
  /** Resolves once connected, rejects when nothing listens at pipe. */
  connect: (pipe: string) => Promise<McpSocket>;
};

/** Signal 0 checks existence only; EPERM means another user's process, never this user's window. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function connect(pipe: string): Promise<McpSocket> {
  return new Promise((resolve, reject) => {
    const socket = netConnect(pipe);
    socket.setEncoding('utf8');
    socket.once('error', reject);
    socket.once('connect', () => {
      socket.off('error', reject);
      // A reset hub emits error right before close, and close is what the
      // client acts on; without a listener the error would throw instead.
      socket.on('error', () => undefined);
      resolve({
        write: data => {
          socket.write(data);
        },
        end: () => {
          socket.end();
        },
        onData: listener => {
          socket.on('data', listener);
        },
        onClose: listener => {
          socket.on('close', () => listener());
        },
      });
    });
  });
}

export const nodeIo: McpIo = {
  homedir,
  platform: () => process.platform,
  cwd: () => process.cwd(),
  randomId: () => randomUUID(),
  readFile: path => fs.readFile(path, 'utf8'),
  writeFile: (path, data, mode) => fs.writeFile(path, data, { mode }),
  createFile: (path, data) => fs.writeFile(path, data, { flag: 'wx' }),
  rename: (from, to) => fs.rename(from, to),
  unlink: path => fs.unlink(path),
  stat: async path => {
    const { size, mtimeMs, mode } = await fs.stat(path);
    return { size, mtimeMs, mode: mode & 0o777 };
  },
  readdir: async path => {
    const entries = await fs.readdir(path, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      directory: entry.isDirectory(),
    }));
  },
  realpath: path => fs.realpath(path),
  isAlive,
  connect,
};
