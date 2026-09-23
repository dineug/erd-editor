import {
  type DiscoveryResult,
  lockDirPath,
  type LockFile,
  lockFilePath,
  lockFilePid,
  pipePath,
  selectHub,
} from '@dineug/erd-editor-agent-hub';

import { type McpIo } from '@/io';
import { logUnsafe } from '@/logger';

/** Every lock file in the lock directory, unparsed; one deleted mid-read is skipped. */
export async function readLockFiles(io: McpIo): Promise<LockFile[]> {
  const home = io.homedir();
  const entries = await io.readdir(lockDirPath(home)).catch(() => []);
  const locks: LockFile[] = [];

  for (const { name } of entries) {
    const pid = lockFilePid(name);
    if (pid === null) continue;

    const path = lockFilePath(home, pid);
    try {
      const [raw, { mtimeMs }] = await Promise.all([
        io.readFile(path),
        io.stat(path),
      ]);
      locks.push({ pid, raw, mtimeMs });
    } catch {
      continue;
    }
  }
  return locks;
}

const unlinkQuietly = (io: McpIo, path: string) =>
  io.unlink(path).catch(() => undefined);

/** A dead window's lock, its temp file and the socket beside it; a named pipe is no file. */
async function removeDeadLock(io: McpIo, pid: number): Promise<void> {
  const home = io.homedir();
  const platform = io.platform();
  const lock = lockFilePath(home, pid);

  await unlinkQuietly(io, lock);
  await unlinkQuietly(io, `${lock}.tmp`);
  if (platform !== 'win32') {
    await unlinkQuietly(io, pipePath(home, pid, platform));
  }
}

/**
 * Picks the window that holds targetPath, a real absolute path. Run before
 * every write, so a hub that appeared or went away since the last call is
 * seen. Dead windows' locks are deleted; a malformed live one is left alone.
 */
export async function discover(
  io: McpIo,
  targetPath: string
): Promise<DiscoveryResult> {
  const locks = await readLockFiles(io);
  const { selected, stale } = selectHub(locks, targetPath, io.platform(), pid =>
    io.isAlive(pid)
  );

  for (const { pid, reason } of stale) {
    if (reason === 'dead') {
      await removeDeadLock(io, pid);
    } else {
      logUnsafe(`skipped the lock of pid ${pid}: it does not parse`);
    }
  }
  return selected;
}
