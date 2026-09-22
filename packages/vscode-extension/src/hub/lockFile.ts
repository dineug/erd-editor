import {
  LOCK_FILE_MODE,
  lockDirPath,
  type LockFile,
  lockFilePath,
  lockFilePid,
  type LockRecord,
  type Platform,
  selectHub,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';

import { type HubIo } from '@/hub/io';
import { socketFilePaths } from '@/hub/pipePath';

/** Resolves whether or not the file was there; a missing file is the usual case. */
export function unlinkQuietly(io: HubIo, path: string): Promise<void> {
  return io.unlink(path).catch(() => undefined);
}

function tempPath(lockPath: string): string {
  return `${lockPath}.tmp`;
}

/**
 * Writes the temp file with LOCK_FILE_MODE, then renames it over the lock: a
 * rename keeps the source's mode, so the lock is never readable by others.
 * A leftover temp goes first, since writeFile keeps an existing file's mode.
 */
export async function writeLockFile(
  io: HubIo,
  lockPath: string,
  record: LockRecord
): Promise<void> {
  const temp = tempPath(lockPath);

  await unlinkQuietly(io, temp);
  await io.writeFile(temp, serializeLock(record), LOCK_FILE_MODE);
  await io.rename(temp, lockPath);
}

export async function removeLockFile(
  io: HubIo,
  lockPath: string
): Promise<void> {
  await unlinkQuietly(io, lockPath);
  await unlinkQuietly(io, tempPath(lockPath));
}

async function readLockFiles(
  io: HubIo,
  homeDir: string,
  ownPid: number
): Promise<LockFile[]> {
  const dir = lockDirPath(homeDir);
  const names = await io.readdir(dir).catch((): string[] => []);
  const locks: LockFile[] = [];

  for (const name of names) {
    const pid = lockFilePid(name);
    if (pid === null || pid === ownPid) continue;

    const path = lockFilePath(homeDir, pid);
    try {
      const [raw, { mtimeMs }] = await Promise.all([
        io.readFile(path),
        io.stat(path),
      ]);
      locks.push({ pid, raw, mtimeMs });
    } catch {
      // Its window deleted it between readdir and now.
      continue;
    }
  }

  return locks;
}

/**
 * Deletes the lock, temp file and socket of every window whose pid is dead.
 * The empty target matches no lock, so selectHub only sorts out the stale;
 * a malformed lock of a live pid may be mid-write and is left alone.
 */
export async function cleanStaleLocks(
  io: HubIo,
  homeDir: string,
  tmpDir: string,
  ownPid: number,
  platform: Platform
): Promise<void> {
  const locks = await readLockFiles(io, homeDir, ownPid);
  const { stale } = selectHub(locks, '', platform, pid => io.isAlive(pid));

  for (const { pid, reason } of stale) {
    if (reason !== 'dead') continue;

    await removeLockFile(io, lockFilePath(homeDir, pid));
    for (const socket of socketFilePaths(homeDir, tmpDir, pid, platform)) {
      await unlinkQuietly(io, socket);
    }
  }
}
