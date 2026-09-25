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

const byAge = (a: DriveFolder, b: DriveFolder) =>
  Date.parse(a.createdTime) - Date.parse(b.createdTime) ||
  (a.id < b.id ? -1 : 1);

/** The oldest by createdTime, then by id: every tab and device settles on the same one. */
export function pickAppFolder(folders: DriveFolder[]): DriveFolder | null {
  return [...folders].sort(byAge)[0] ?? null;
}

export type AppFolderDeps = {
  drive: Pick<DriveClient, 'getFile' | 'findAppFolders' | 'createAppFolder'>;
  /** Without Web Locks each tab looks on its own, and the oldest folder wins later. */
  locks: Pick<FileLockManagerLike, 'request'> | null;
};

/**
 * The ERD Editor folder new and imported files go in: found by its marker or
 * created, under a lock per account so a browser's tabs make one, its id cached
 * and checked before each use, and looked up again once gone or in the trash.
 */
export function createAppFolder({ drive, locks }: AppFolderDeps) {
  const cached = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();

  const isUsable = async (id: string) => {
    try {
      return !(await drive.getFile(id)).trashed;
    } catch (error) {
      if (error instanceof DriveError && error.kind === 'not-found') {
        return false;
      }
      throw error;
    }
  };

  // Looks again inside the lock: another tab may have created it meanwhile.
  const findOrCreate = async (sub: string) => {
    const found = pickAppFolder(await drive.findAppFolders());
    const id = found?.id ?? (await drive.createAppFolder()).id;
    cached.set(sub, id);
    return id;
  };

  const underLock = async (sub: string) => {
    if (!locks) return await findOrCreate(sub);
    let id = '';
    await locks.request(appFolderLockName(sub), {}, async () => {
      id = await findOrCreate(sub);
    });
    return id;
  };

  const resolve = async (sub: string) => {
    const known = cached.get(sub);
    if (known) {
      if (await isUsable(known)) return known;
      cached.delete(sub);
    }
    return await underLock(sub);
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

export type AppFolder = ReturnType<typeof createAppFolder>;
