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

const isOpen = (folder: DriveFolder) =>
  !folder.trashed && folder.canAddChildren;

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
};

/**
 * The ERD Editor folder new and imported files go in: found by its marker or
 * created, under a lock per account so a browser's tabs make one, checked before
 * each use, and looked up again once gone, in the trash or closed to new files.
 */
export function createAppFolder({ drive, locks, isCurrent }: AppFolderDeps) {
  /** Per account, and whether a list has shown it yet: until one does, each use looks again. */
  const cached = new Map<string, { folder: DriveFolder; listed: boolean }>();
  const pending = new Map<string, Promise<string>>();

  const stillCurrent = (sub: string) => {
    if (!isCurrent(sub)) throw new AccountChangedError();
  };

  /** The folder as Drive has it now, or null once deleted, in the trash or closed to new files. */
  const reread = async (id: string) => {
    try {
      const folder = await drive.getFolder(id);
      return isOpen(folder) ? folder : null;
    } catch (error) {
      if (error instanceof DriveError && error.kind === 'not-found') {
        return null;
      }
      throw error;
    }
  };

  // Looks inside the lock: another tab may have created it while this one waited.
  const findOrCreate = async (sub: string, known: DriveFolder | null) => {
    let listed = await drive.findAppFolders();
    stillCurrent(sub);
    let chosen = pickAppFolder(known ? [known, ...listed] : listed);
    if (!chosen) {
      const created = await drive.createAppFolder();
      stillCurrent(sub);
      // Another device may have made one meanwhile: both move to the older.
      listed = await drive.findAppFolders().catch(() => []);
      stillCurrent(sub);
      chosen = [created, ...listed.filter(isOpen)].sort(byAge)[0];
    }
    const { id } = chosen;
    cached.set(sub, {
      folder: chosen,
      listed: listed.some(folder => folder.id === id),
    });
    return id;
  };

  const underLock = async (sub: string, known: DriveFolder | null) => {
    if (!locks) return await findOrCreate(sub, known);
    let id = '';
    await locks.request(appFolderLockName(sub), {}, async () => {
      id = await findOrCreate(sub, known);
    });
    return id;
  };

  const resolve = async (sub: string) => {
    const known = cached.get(sub);
    if (!known) return await underLock(sub, null);
    const folder = await reread(known.folder.id);
    stillCurrent(sub);
    if (folder && known.listed) return folder.id;
    if (!folder) cached.delete(sub);
    return await underLock(sub, folder);
  };

  return {
    /** The account's folder id; calls while one is under way share its answer. */
    folderId(sub: string): Promise<string> {
      const running = pending.get(sub);
      if (running) return running;
      const run = resolve(sub).finally(() => pending.delete(sub));
      pending.set(sub, run);
      return run;
    },
  };
}
