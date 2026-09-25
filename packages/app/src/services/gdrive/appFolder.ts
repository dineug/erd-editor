import {
  type DriveClient,
  DriveError,
  type DriveFolder,
} from '@/services/gdrive/driveClient';
import type { FileLockManagerLike } from '@/services/gdrive/fileLeader';

export const APP_FOLDER_LOCK_PREFIX = '@dineug/erd-editor-app/gdrive-folder';

/** One lock per account, so another account's tabs look for their own folder. */
export function appFolderLockName(sub: string): string {
  return `${APP_FOLDER_LOCK_PREFIX}/${sub}`;
}

/** A lookup another account's sign-in overtook: the calls it made went out with that account's token. */
export class AccountChangedError extends Error {
  name = 'AccountChangedError';

  constructor() {
    super('The account changed while its ERD Editor folder was looked up');
  }
}

/** Takes new files, in My Drive: one in the trash, closed to the account or in a shared drive is passed over. */
const isOpen = (folder: DriveFolder) =>
  !folder.trashed && folder.canAddChildren && folder.driveId === null;

const byAge = (a: DriveFolder, b: DriveFolder) =>
  Date.parse(a.createdTime) - Date.parse(b.createdTime) ||
  (a.id < b.id ? -1 : 1);

/** The oldest open to new files, by createdTime, then by id: every tab and device settles on the same one. */
export function pickAppFolder(folders: DriveFolder[]): DriveFolder | null {
  return folders.filter(isOpen).sort(byAge)[0] ?? null;
}

export type AppFolderDeps = {
  drive: Pick<DriveClient, 'getFolder' | 'findAppFolders' | 'createAppFolder'>;
  /** Without Web Locks each tab looks on its own, and tabs that each made one move to the oldest. */
  locks: Pick<FileLockManagerLike, 'request'> | null;
  /** Whether sub is still the signed-in account, whose token the Drive calls carry. */
  isCurrent: (sub: string) => boolean;
  /** Tells the account's other tabs of a folder no list shows yet, while the lock is still held. */
  share?: (sub: string, folderId: string) => void;
};

/**
 * The ERD Editor folder new and imported files go in: on every use, under a
 * lock per account, the oldest open one a list shows or this tab knows of,
 * else a new one, so every tab and device settles on one and a browser makes one.
 */
export function createAppFolder({
  drive,
  locks,
  isCurrent,
  share,
}: AppFolderDeps) {
  /** Per account, the folders this tab used, made or heard of: a list may lag a create, or fail. */
  const known = new Map<string, Set<string>>();
  const running = new Map<string, Promise<string>>();

  const knownOf = (sub: string) => {
    const ids = known.get(sub) ?? new Set<string>();
    known.set(sub, ids);
    return ids;
  };

  const stillCurrent = (sub: string) => {
    if (!isCurrent(sub)) throw new AccountChangedError();
  };

  /** The folder as Drive has it now, or null once deleted. */
  const reread = async (id: string) => {
    try {
      return await drive.getFolder(id);
    } catch (error) {
      if (error instanceof DriveError && error.kind === 'not-found') {
        return null;
      }
      throw error;
    }
  };

  /** The known folders the list left out, read one by one; a folder no longer open is forgotten. */
  const recheck = async (
    sub: string,
    ids: Set<string>,
    listed: DriveFolder[]
  ) => {
    const open: DriveFolder[] = [];
    for (const id of ids) {
      if (listed.some(folder => folder.id === id)) continue;
      const folder = await reread(id);
      stillCurrent(sub);
      if (folder && isOpen(folder)) open.push(folder);
      else ids.delete(id);
    }
    return open;
  };

  // Looks inside the lock: another tab may have created one while this one waited.
  const lookUp = async (sub: string) => {
    const ids = knownOf(sub);
    let listed: DriveFolder[];
    try {
      listed = await drive.findAppFolders();
    } catch (error) {
      stillCurrent(sub);
      const fallback = pickAppFolder(await recheck(sub, ids, []));
      if (!fallback) throw error;
      return fallback.id;
    }
    stillCurrent(sub);
    let chosen = pickAppFolder([
      ...(await recheck(sub, ids, listed)),
      ...listed,
    ]);
    if (!chosen) {
      const created = await drive.createAppFolder();
      stillCurrent(sub);
      ids.add(created.id);
      // Another device may have made one meanwhile: both move to the older.
      listed = await drive.findAppFolders().catch(() => []);
      chosen = [created, ...listed.filter(isOpen)].sort(byAge)[0];
    }
    // Nothing is awaited from here, so share tells the tabs of this very account.
    stillCurrent(sub);
    const { id } = chosen;
    ids.add(id);
    if (!listed.some(folder => folder.id === id)) share?.(sub, id);
    return id;
  };

  const underLock = async (sub: string) => {
    if (!locks) return await lookUp(sub);
    let id = '';
    await locks.request(appFolderLockName(sub), {}, async () => {
      id = await lookUp(sub);
    });
    return id;
  };

  return {
    /** The account's folder id; calls while one is under way share its answer. */
    folderId(sub: string): Promise<string> {
      const pending = running.get(sub);
      if (pending) return pending;
      const run = underLock(sub).finally(() => running.delete(sub));
      running.set(sub, run);
      return run;
    },

    /** A folder another tab of the account made or chose, which the next lookup here weighs too. */
    learn(sub: string, folderId: string) {
      knownOf(sub).add(folderId);
    },
  };
}
