import { describe, expect, it } from 'vite-plus/test';

import {
  createFakeDrive,
  createLockManager,
  type FakeDrive,
  type FakeLockManager,
} from '@/__test-utils__/gdrive';
import {
  APP_FOLDER_LOCK_PREFIX,
  appFolderLockName,
  createAppFolder,
  pickAppFolder,
} from '@/services/gdrive/appFolder';
import { createDriveClient } from '@/services/gdrive/driveClient';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MARKER = { erdEditorFolder: '1' };
const SUB = '1001';

/** One tab's folder service over a Drive and locks it may share with other tabs. */
function tab(
  drive: FakeDrive,
  locks: FakeLockManager | null = createLockManager()
) {
  const client = createDriveClient({
    fetch: drive.fetch,
    getAccessToken: async () => 'drive-token-1',
    onUnauthorized: async token => token,
  });
  return createAppFolder({ drive: client, locks });
}

function addFolder(drive: FakeDrive, createdTime?: string, name = 'Diagrams') {
  return drive.add({
    name,
    mimeType: FOLDER_MIME,
    appProperties: MARKER,
    ...(createdTime ? { createdTime } : {}),
  });
}

const posts = (drive: FakeDrive) => drive.callsTo('POST');
const lists = (drive: FakeDrive) =>
  drive.callsTo('GET').filter(call => call.url.pathname === '/drive/v3/files');

describe('appFolderLockName', () => {
  it('names the account, so another account never waits on it', () => {
    expect(APP_FOLDER_LOCK_PREFIX).toBe('@dineug/erd-editor-app/gdrive-folder');
    expect(appFolderLockName('1001')).toBe(
      '@dineug/erd-editor-app/gdrive-folder/1001'
    );
  });
});

describe('pickAppFolder', () => {
  it('takes the oldest by createdTime, then the lowest id, whatever the order', () => {
    const folders = [
      { id: 'c', createdTime: '2026-09-02T00:00:00.000Z' },
      { id: 'b', createdTime: '2026-09-01T00:00:00.000Z' },
      { id: 'a', createdTime: '2026-09-01T00:00:00.000Z' },
    ];

    expect(pickAppFolder(folders)?.id).toBe('a');
    expect(pickAppFolder([...folders].reverse())?.id).toBe('a');
    expect(pickAppFolder([])).toBeNull();
  });
});

describe('createAppFolder', () => {
  it('finds the folder by its marker, renamed or moved, and creates nothing', async () => {
    const drive = createFakeDrive();
    const folder = addFolder(drive);
    drive.files.get(folder.id)!.parents = ['projects'];
    drive.add({ name: 'ERD Editor', mimeType: FOLDER_MIME });

    await expect(tab(drive).folderId(SUB)).resolves.toBe(folder.id);
    expect(posts(drive)).toEqual([]);
  });

  it('creates one ERD Editor folder in My Drive when there is none', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);

    const id = await folders.folderId(SUB);

    expect(drive.files.get(id)).toMatchObject({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      parents: ['root'],
      appProperties: MARKER,
    });
    expect(posts(drive)).toHaveLength(1);
  });

  it('creates a new one when the only one is in the trash', async () => {
    const drive = createFakeDrive();
    const trashed = addFolder(drive);
    drive.files.get(trashed.id)!.trashed = true;

    const id = await tab(drive).folderId(SUB);

    expect(id).not.toBe(trashed.id);
    expect(drive.files.get(id)?.trashed).toBe(false);
    expect(posts(drive)).toHaveLength(1);
  });

  it('takes the oldest of several, as another device would', async () => {
    const drive = createFakeDrive();
    addFolder(drive, '2026-09-03T00:00:00.000Z');
    const oldest = addFolder(drive, '2026-09-01T00:00:00.000Z');
    addFolder(drive, '2026-09-02T00:00:00.000Z');

    await expect(tab(drive).folderId(SUB)).resolves.toBe(oldest.id);
    await expect(tab(drive).folderId(SUB)).resolves.toBe(oldest.id);
  });

  it('keeps the id per account and checks it before each use, without looking again', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const id = await folders.folderId(SUB);
    const listed = lists(drive).length;

    await expect(folders.folderId(SUB)).resolves.toBe(id);

    expect(lists(drive)).toHaveLength(listed);
    expect(drive.callsTo('GET').at(-1)?.url.pathname).toBe(
      `/drive/v3/files/${id}`
    );
    await folders.folderId('2002');
    expect(lists(drive)).toHaveLength(listed + 1);
  });

  it('looks again once the cached folder is deleted, and again once it is in the trash', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const first = await folders.folderId(SUB);

    drive.files.delete(first);
    const second = await folders.folderId(SUB);
    expect(second).not.toBe(first);

    drive.files.get(second)!.trashed = true;
    const third = await folders.folderId(SUB);
    expect(third).not.toBe(second);
    expect(posts(drive)).toHaveLength(3);
    await expect(folders.folderId(SUB)).resolves.toBe(third);
  });

  it('moves to a folder another tab settled on once its own is gone', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const mine = await folders.folderId(SUB);
    const other = addFolder(drive, '2026-01-01T00:00:00.000Z');

    await expect(folders.folderId(SUB)).resolves.toBe(mine);
    drive.files.delete(mine);
    await expect(folders.folderId(SUB)).resolves.toBe(other.id);
  });

  it('passes on a check that fails otherwise, and keeps the id for the next call', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const id = await folders.folderId(SUB);
    drive.failNext('GET', 403, 'insufficientFilePermissions');

    await expect(folders.folderId(SUB)).rejects.toMatchObject({
      kind: 'forbidden',
    });
    await expect(folders.folderId(SUB)).resolves.toBe(id);
    expect(posts(drive)).toHaveLength(1);
  });

  it('passes on a failed create, and tries again on the next call', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.failNext('POST', 500);

    await expect(folders.folderId(SUB)).rejects.toMatchObject({
      kind: 'server',
    });
    const id = await folders.folderId(SUB);
    expect(drive.files.get(id)?.name).toBe('ERD Editor');
  });

  it('shares one lookup among the calls of a tab made while it runs', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);

    const ids = await Promise.all([
      folders.folderId(SUB),
      folders.folderId(SUB),
    ]);

    expect(ids[0]).toBe(ids[1]);
    expect(lists(drive)).toHaveLength(1);
    expect(posts(drive)).toHaveLength(1);
  });

  it('creates one folder for the tabs of a browser, under the account lock', async () => {
    const drive = createFakeDrive();
    const locks = createLockManager();

    const ids = await Promise.all([
      tab(drive, locks).folderId(SUB),
      tab(drive, locks).folderId(SUB),
    ]);

    expect(ids[0]).toBe(ids[1]);
    expect(posts(drive)).toHaveLength(1);
    expect(locks.requests).toEqual([
      appFolderLockName(SUB),
      appFolderLockName(SUB),
    ]);
  });

  it('runs without Web Locks, each tab on its own', async () => {
    const drive = createFakeDrive();
    const first = await tab(drive, null).folderId(SUB);

    await expect(tab(drive, null).folderId(SUB)).resolves.toBe(first);
    expect(posts(drive)).toHaveLength(1);
  });
});
