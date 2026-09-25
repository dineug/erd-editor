import { describe, expect, it } from 'vite-plus/test';

import {
  createFakeDrive,
  createLockManager,
  type FakeDrive,
  type FakeLockManager,
} from '@/__test-utils__/gdrive';
import {
  AccountChangedError,
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
  locks: FakeLockManager | null = createLockManager(),
  isCurrent: (sub: string) => boolean = () => true
) {
  const client = createDriveClient({
    fetch: drive.fetch,
    getAccessToken: async () => 'drive-token-1',
    onUnauthorized: async token => token,
  });
  return createAppFolder({ drive: client, locks, isCurrent });
}

function addFolder(drive: FakeDrive, createdTime?: string, name = 'Diagrams') {
  return drive.add({
    name,
    mimeType: FOLDER_MIME,
    appProperties: MARKER,
    ...(createdTime ? { createdTime } : {}),
  });
}

const isList = (url: URL) => url.pathname === '/drive/v3/files';
const posts = (drive: FakeDrive) => drive.callsTo('POST');
const lists = (drive: FakeDrive) =>
  drive.callsTo('GET').filter(call => isList(call.url));
const checksOf = (drive: FakeDrive, id: string) =>
  drive
    .callsTo('GET')
    .filter(call => call.url.pathname === `/drive/v3/files/${id}`);

/** Real timers here: waits a task at a time until the fake Drive has seen enough. */
async function until(done: () => boolean) {
  while (!done()) await new Promise(resolve => setTimeout(resolve, 0));
}

describe('appFolderLockName', () => {
  it('names the account, so another account never waits on it', () => {
    expect(APP_FOLDER_LOCK_PREFIX).toBe('@dineug/erd-editor-app/gdrive-folder');
    expect(appFolderLockName('1001')).toBe(
      '@dineug/erd-editor-app/gdrive-folder/1001'
    );
  });
});

describe('pickAppFolder', () => {
  const open = { trashed: false, canAddChildren: true };

  it('takes the oldest by createdTime, then the lowest id, whatever the order', () => {
    const folders = [
      { id: 'c', createdTime: '2026-09-02T00:00:00.000Z', ...open },
      { id: 'b', createdTime: '2026-09-01T00:00:00.000Z', ...open },
      { id: 'a', createdTime: '2026-09-01T00:00:00.000Z', ...open },
    ];

    expect(pickAppFolder(folders)?.id).toBe('a');
    expect(pickAppFolder([...folders].reverse())?.id).toBe('a');
    expect(pickAppFolder([])).toBeNull();
  });

  it('passes over a folder in the trash or closed to new files', () => {
    const oldest = '2026-09-01T00:00:00.000Z';

    expect(
      pickAppFolder([
        { id: 'a', createdTime: oldest, ...open, trashed: true },
        { id: 'b', createdTime: oldest, ...open, canAddChildren: false },
        { id: 'c', createdTime: '2026-09-02T00:00:00.000Z', ...open },
      ])?.id
    ).toBe('c');
    expect(
      pickAppFolder([
        { id: 'a', createdTime: oldest, trashed: false, canAddChildren: false },
      ])
    ).toBeNull();
  });
});

describe('createAppFolder', () => {
  it('finds the folder by its marker, renamed or moved, and creates nothing', async () => {
    const drive = createFakeDrive();
    const folder = addFolder(drive);
    const parent = drive.add({ name: 'Projects', mimeType: FOLDER_MIME });
    drive.files.get(folder.id)!.parents = [parent.id];
    drive.add({ name: 'ERD Editor', mimeType: FOLDER_MIME });

    await expect(tab(drive).folderId(SUB)).resolves.toBe(folder.id);
    expect(posts(drive)).toEqual([]);
  });

  it('creates one ERD Editor folder in My Drive when there is none, and lists again after', async () => {
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
    expect(lists(drive)).toHaveLength(2);
    expect(drive.calls.map(call => call.method)).toEqual([
      'GET',
      'POST',
      'GET',
    ]);
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

  it('passes over a folder the account can no longer add files to, and makes one it can', async () => {
    const drive = createFakeDrive();
    const closed = addFolder(drive, '2026-01-01T00:00:00.000Z');
    drive.files.get(closed.id)!.canEdit = false;
    const folders = tab(drive);

    const id = await folders.folderId(SUB);
    expect(id).not.toBe(closed.id);
    expect(posts(drive)).toHaveLength(1);

    drive.files.get(id)!.canEdit = false;
    const next = await folders.folderId(SUB);
    expect(next).not.toBe(id);
    expect(drive.files.get(next)?.canEdit).toBe(true);
    expect(posts(drive)).toHaveLength(2);
  });

  it('takes the oldest of several, as another device would', async () => {
    const drive = createFakeDrive();
    addFolder(drive, '2026-09-03T00:00:00.000Z');
    const oldest = addFolder(drive, '2026-09-01T00:00:00.000Z');
    addFolder(drive, '2026-09-02T00:00:00.000Z');

    await expect(tab(drive).folderId(SUB)).resolves.toBe(oldest.id);
    await expect(tab(drive).folderId(SUB)).resolves.toBe(oldest.id);
  });

  it('moves a device that lost the race to the older folder at once', async () => {
    const drive = createFakeDrive();
    const releaseFirst = drive.hold('POST');
    const releaseSecond = drive.hold('POST');
    // Two browsers: neither lock keeps the other out.
    const first = tab(drive).folderId(SUB);
    const second = tab(drive).folderId(SUB);
    await until(() => posts(drive).length === 2);

    releaseFirst();
    await until(() => drive.files.has('created-folder-1'));
    releaseSecond();

    await expect(Promise.all([first, second])).resolves.toEqual([
      'created-folder-1',
      'created-folder-1',
    ]);
    expect(drive.files.get('created-folder-2')?.appProperties).toEqual(MARKER);
  });

  it('keeps the id per account and checks it before each use, without looking again', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const id = await folders.folderId(SUB);
    const listed = lists(drive).length;

    await expect(folders.folderId(SUB)).resolves.toBe(id);

    expect(lists(drive)).toHaveLength(listed);
    const check = drive.callsTo('GET').at(-1)!;
    expect(check.url.pathname).toBe(`/drive/v3/files/${id}`);
    expect(check.url.searchParams.get('fields')).toBe(
      'id,createdTime,trashed,capabilities(canAddChildren)'
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

  it('forgets a folder found gone, so a lookup that fails after it asks for it no more', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const gone = await folders.folderId(SUB);
    drive.files.delete(gone);
    drive.failNext('GET', 500, 'backendError', isList);

    await expect(folders.folderId(SUB)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(checksOf(drive, gone)).toHaveLength(1);

    const fresh = await folders.folderId(SUB);
    expect(fresh).not.toBe(gone);
    expect(checksOf(drive, gone)).toHaveLength(1);
  });

  it('keeps a folder the list has shown, and moves to the oldest left once it is gone', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const mine = await folders.folderId(SUB);
    const other = addFolder(drive, '2026-01-01T00:00:00.000Z');

    await expect(folders.folderId(SUB)).resolves.toBe(mine);
    drive.files.delete(mine);
    await expect(folders.folderId(SUB)).resolves.toBe(other.id);
  });

  it('looks again while the list has yet to show a folder it made, and moves to an older one it then shows', async () => {
    const drive = createFakeDrive();
    const locks = createLockManager();
    drive.unlisted.add('created-folder-1');
    const first = tab(drive, locks);
    const made = await first.folderId(SUB);
    expect(made).toBe('created-folder-1');

    // Another tab of this browser, whose list misses it too, makes a second.
    drive.unlisted.add('created-folder-2');
    const second = tab(drive, locks);
    await expect(second.folderId(SUB)).resolves.toBe('created-folder-2');

    const listed = lists(drive).length;
    await expect(first.folderId(SUB)).resolves.toBe(made);
    expect(lists(drive)).toHaveLength(listed + 1);
    expect(posts(drive)).toHaveLength(2);

    drive.unlisted.clear();
    await expect(second.folderId(SUB)).resolves.toBe(made);
    await expect(first.folderId(SUB)).resolves.toBe(made);
    const settled = lists(drive).length;
    await expect(second.folderId(SUB)).resolves.toBe(made);
    await expect(first.folderId(SUB)).resolves.toBe(made);
    expect(lists(drive)).toHaveLength(settled);
    expect(posts(drive)).toHaveLength(2);
  });

  it('keeps a folder it made when the list after it fails, and looks again on the next use', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const release = drive.hold('POST');
    const run = folders.folderId(SUB);
    await until(() => posts(drive).length === 1);
    drive.failNext('GET', 500, 'backendError', isList);
    release();

    await expect(run).resolves.toBe('created-folder-1');
    const listed = lists(drive).length;
    await expect(folders.folderId(SUB)).resolves.toBe('created-folder-1');
    expect(lists(drive)).toHaveLength(listed + 1);
    expect(posts(drive)).toHaveLength(1);
  });

  it('keeps nothing of a lookup another account signed in during, whatever call it overtook', async () => {
    let current = SUB;
    /** Holds the call when names, and lets it go once another account signed in. */
    const overtaken = async (
      drive: FakeDrive,
      folders: ReturnType<typeof tab>,
      method: string,
      when: (url: URL) => boolean
    ) => {
      current = SUB;
      const release = drive.hold(method, when);
      const seen = drive.callsTo(method).length;
      const run = folders.folderId(SUB);
      await until(() => drive.callsTo(method).length > seen);
      current = '2002';
      release();
      await expect(run).rejects.toBeInstanceOf(AccountChangedError);
      current = SUB;
    };
    const isCurrent = (sub: string) => sub === current;

    // The first list, then the create, then the list after it.
    const drive = createFakeDrive();
    const folders = tab(drive, createLockManager(), isCurrent);
    await overtaken(drive, folders, 'GET', isList);
    expect(posts(drive)).toEqual([]);
    await overtaken(drive, folders, 'POST', () => true);
    await expect(folders.folderId(SUB)).resolves.toBe('created-folder-1');
    const relisted = createFakeDrive();
    const again = tab(relisted, createLockManager(), isCurrent);
    await overtaken(
      relisted,
      again,
      'GET',
      url => isList(url) && posts(relisted).length === 1
    );
    await expect(again.folderId(SUB)).resolves.toBe('created-folder-1');
    expect(posts(drive)).toHaveLength(1);
    expect(posts(relisted)).toHaveLength(1);

    // The check: another account's token finds no such folder, which is kept all the same.
    const id = 'created-folder-1';
    const folder = drive.files.get(id)!;
    const release = drive.hold('GET', url => !isList(url));
    const run = folders.folderId(SUB);
    await until(() => checksOf(drive, id).length === 1);
    current = '2002';
    drive.files.delete(id);
    release();
    await expect(run).rejects.toBeInstanceOf(AccountChangedError);

    current = SUB;
    drive.files.set(id, folder);
    const listed = lists(drive).length;
    await expect(folders.folderId(SUB)).resolves.toBe(id);
    expect(lists(drive)).toHaveLength(listed);
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
    expect(lists(drive)).toHaveLength(2);
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

  it('runs without Web Locks, each tab on its own, and tabs that each made one settle on the older', async () => {
    const drive = createFakeDrive();
    const first = await tab(drive, null).folderId(SUB);

    await expect(tab(drive, null).folderId(SUB)).resolves.toBe(first);
    expect(posts(drive)).toHaveLength(1);

    const other = createFakeDrive();
    const ids = await Promise.all([
      tab(other, null).folderId(SUB),
      tab(other, null).folderId(SUB),
    ]);
    expect(posts(other)).toHaveLength(2);
    expect(ids).toEqual(['created-folder-1', 'created-folder-1']);
  });
});
