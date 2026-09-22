import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { homedir, tmpdir } from 'node:os';

/** One accepted connection, decoded to text with a streaming UTF-8 decoder. */
export type HubSocket = {
  write: (data: string) => void;
  /** Closes after the pending writes flush, so a last error frame arrives. */
  end: () => void;
  destroy: () => void;
  onData: (listener: (chunk: string) => void) => void;
  onClose: (listener: () => void) => void;
};

export type HubServerHandle = {
  /** Stops accepting; resolves once the listener is closed, never rejects. */
  close: () => Promise<void>;
};

/**
 * Every net and fs call the hub makes. The hub modules see only this type, so
 * the unit suite swaps in a memory double; nodeHubIo is the one real binding.
 */
export type HubIo = {
  homedir: () => string;
  tmpdir: () => string;
  platform: () => string;
  pid: () => number;
  randomToken: () => string;
  /** Recursive; the mode applies to the directories it creates. */
  mkdir: (path: string, mode: number) => Promise<void>;
  /** The mode applies when the file is created, as with fs.writeFile. */
  writeFile: (path: string, data: string, mode: number) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  readdir: (path: string) => Promise<string[]>;
  stat: (path: string) => Promise<{ mtimeMs: number }>;
  /** Resolves when the entry exists, a dangling symlink included; never follows the last link. */
  lstat: (path: string) => Promise<unknown>;
  unlink: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  realpath: (path: string) => Promise<string>;
  isAlive: (pid: number) => boolean;
  listen: (
    pipe: string,
    onConnection: (socket: HubSocket) => void
  ) => Promise<HubServerHandle>;
};

function toHubSocket(socket: Socket): HubSocket {
  socket.setEncoding('utf8');
  // A reset peer emits error right before close, and close is what the hub
  // acts on; without a listener the error would throw in the host instead.
  socket.on('error', () => undefined);

  return {
    write: data => {
      socket.write(data);
    },
    end: () => {
      socket.end();
    },
    destroy: () => {
      socket.destroy();
    },
    onData: listener => {
      socket.on('data', listener);
    },
    onClose: listener => {
      socket.on('close', () => listener());
    },
  };
}

/** Signal 0 checks existence only; EPERM means another user's process, never this user's window. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listen(
  pipe: string,
  onConnection: (socket: HubSocket) => void
): Promise<HubServerHandle> {
  return new Promise((resolve, reject) => {
    const server = createServer(socket => onConnection(toHubSocket(socket)));

    server.once('error', reject);
    server.listen(pipe, () => {
      server.off('error', reject);
      server.on('error', error => console.warn('[erd-editor hub]', error));
      resolve({
        close: () => new Promise(done => server.close(() => done())),
      });
    });
  });
}

export const nodeHubIo: HubIo = {
  homedir,
  tmpdir,
  platform: () => process.platform,
  pid: () => process.pid,
  randomToken: () => randomUUID(),
  mkdir: async (path, mode) => {
    await fs.mkdir(path, { recursive: true, mode });
  },
  writeFile: (path, data, mode) => fs.writeFile(path, data, { mode }),
  readFile: path => fs.readFile(path, 'utf8'),
  readdir: path => fs.readdir(path),
  stat: path => fs.stat(path),
  lstat: path => fs.lstat(path),
  unlink: path => fs.unlink(path),
  rename: (from, to) => fs.rename(from, to),
  realpath: path => fs.realpath(path),
  isAlive,
  listen,
};
