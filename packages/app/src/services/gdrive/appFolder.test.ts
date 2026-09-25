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
  type AppFolderDeps,
  appFolderLockName,
  createAppFolder,
  pickAppFolder,
} from '@/services/gdrive/appFolder';
import { createDriveClient, RETRY_LIMIT } from '@/services/gdrive/driveClient';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MARKER = { erdEditorFolder: '1' };
const SUB = '1001';

/** One tab's folder service over a Drive and locks it may share with other tabs. */
function tab(
  drive: FakeDrive,
  locks: FakeLockManager | null = createLockManager(),
  isCurrent: (sub: string) => boolean = () => true,
  share?: AppFolderDeps['share']
) {
  const client = createDriveClient({
    fetch: drive.fetch,
    getAccessToken: async () => 'drive-token-1',
    onUnauthorized: async token => token,
  });
  return createAppFolder({
    drive: client,
    locks,
    isCurrent,
    share,
    retry: { sleep: async () => {}, random: () => 0 },
  });
}

type Tab = ReturnType<typeof tab>;

/**
 * Tabs of one browser: shared locks, and what one shares reaches the others a
 * task later, as the account's files channel delivers it.
 */
function browserTabs(drive: FakeDrive, count: number) {
  const locks = createLockManager();
  const shared: Array<{ folderId: string; lockHeld: boolean }> = [];
  const tabs: Tab[] = [];
  for (let n = 0; n < count; n++) {
    const self: Tab = tab(drive, locks, undefined, (sub, folderId) => {
      shared.push({ folderId, lockHeld: locks.isHeld(appFolderLockName(sub)) });
      for (const other of tabs) {
        if (other !== self) setTimeout(() => other.learn(sub, folderId), 0);
      }
    });
    tabs.push(self);
  }
  return { tabs, shared };
}

function addFolder(drive: FakeDrive, createdTime?: string) {
  return drive.add({
    name: 'Diagrams',
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

/** Fails the next GETs of URLs when matches, one for every attempt withRetry makes. */
function failGets(drive: FakeDrive, when: (url: URL) => boolean) {
  for (let n = 0; n <= RETRY_LIMIT; n++) {
    drive.failNext('GET', 500, 'backendError', when);
  }
}

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
  const open = {
    trashed: false,
    driveId: null,
    ownedByMe: true,
    canAddChildren: true,
  };

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

  it("passes over a folder in the trash, closed to new files, in a shared drive or another person's", () => {
    const oldest = '2026-09-01T00:00:00.000Z';

    expect(
      pickAppFolder([
        { id: 'a', createdTime: oldest, ...open, trashed: true },
        { id: 'b', createdTime: oldest, ...open, canAddChildren: false },
        { id: 'c', createdTime: oldest, ...open, driveId: 'team' },
        { id: 'd', createdTime: oldest, ...open, ownedByMe: false },
        { id: 'e', createdTime: '2026-09-02T00:00:00.000Z', ...open },
      ])?.id
    ).toBe('e');
    expect(
      pickAppFolder([
        { id: 'a', createdTime: oldest, ...open, canAddChildren: false },
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

  it("passes over another person's older folder shared with the account, open to it, and makes its own", async () => {
    const drive = createFakeDrive();
    const shared = addFolder(drive, '2026-01-01T00:00:00.000Z');
    drive.files.get(shared.id)!.ownedByMe = false;
    const folders = tab(drive);

    const id = await folders.folderId(SUB);

    expect(id).not.toBe(shared.id);
    expect(drive.files.get(id)).toMatchObject({
      parents: ['root'],
      ownedByMe: true,
    });
    expect(posts(drive)).toHaveLength(1);
    await expect(folders.folderId(SUB)).resolves.toBe(id);
    await expect(tab(drive).folderId(SUB)).resolves.toBe(id);
    expect(posts(drive)).toHaveLength(1);
  });

  it('drops a folder it knows once another person owns it, and makes its own', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    const first = await folders.folderId(SUB);

    // Ownership moved, the account still an editor: the folder stays open to it.
    drive.files.get(first)!.ownedByMe = false;
    const next = await folders.folderId(SUB);

    expect(next).not.toBe(first);
    expect(checksOf(drive, first)).toHaveLength(1);
    await expect(folders.folderId(SUB)).resolves.toBe(next);
    expect(checksOf(drive, first)).toHaveLength(1);
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

  it('lists on every use, one request once the list shows the folder', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const id = await folders.folderId(SUB);
    const listed = lists(drive).length;

    await expect(folders.folderId(SUB)).resolves.toBe(id);

    expect(lists(drive)).toHaveLength(listed + 1);
    expect(checksOf(drive, id)).toEqual([]);
    const { url } = lists(drive).at(-1)!;
    expect(url.searchParams.get('fields')).toBe(
      'nextPageToken,files(id,createdTime,trashed,driveId,ownedByMe,capabilities(canAddChildren))'
    );
  });

  it('keeps what it knows per account, so another account lists for itself and never reads it', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    const mine = await folders.folderId(SUB);
    folders.learn(SUB, 'heard-of');
    const listed = lists(drive).length;

    await expect(folders.folderId('2002')).resolves.toBe('created-folder-2');

    expect(lists(drive)).toHaveLength(listed + 2);
    expect(checksOf(drive, mine)).toEqual([]);
    expect(checksOf(drive, 'heard-of')).toEqual([]);
    await expect(folders.folderId(SUB)).resolves.toBe(mine);
    expect(checksOf(drive, mine)).toHaveLength(1);
  });

  it('forgets what it knew of an account that left, so a sign-in again reads none of it', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    const made = await folders.folderId(SUB);
    folders.forget('2002');
    folders.forget(SUB);

    // The grant a sign-out revoked leaves the folder out of the account's lists.
    const next = await folders.folderId(SUB);

    expect(next).not.toBe(made);
    expect(checksOf(drive, made)).toEqual([]);
  });

  it('moves a tab to an older folder a list shows again, so it and a new tab agree', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const first = await folders.folderId(SUB);

    drive.files.get(first)!.trashed = true;
    const second = await folders.folderId(SUB);
    expect(second).not.toBe(first);

    // Taken out of the trash: older than the one made meanwhile.
    drive.files.get(first)!.trashed = false;
    await expect(folders.folderId(SUB)).resolves.toBe(first);
    await expect(tab(drive).folderId(SUB)).resolves.toBe(first);
    expect(posts(drive)).toHaveLength(2);

    const other = addFolder(drive, '2026-01-01T00:00:00.000Z');
    await expect(folders.folderId(SUB)).resolves.toBe(other.id);
    await expect(tab(drive).folderId(SUB)).resolves.toBe(other.id);
  });

  it('looks again once the folder is deleted, and again once it is in the trash', async () => {
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

  it('passes over a folder in the trash through its parent, which the list leaves out too', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const first = await folders.folderId(SUB);
    const parent = drive.add({ name: 'Projects', mimeType: FOLDER_MIME });
    drive.files.get(first)!.parents = [parent.id];
    drive.files.get(parent.id)!.trashed = true;

    const next = await folders.folderId(SUB);

    expect(next).not.toBe(first);
    expect(drive.files.get(first)?.trashed).toBe(false);
    expect(checksOf(drive, first)).toHaveLength(1);
    expect(posts(drive)).toHaveLength(2);
    // The older folder would win a list that showed it.
    await expect(tab(drive).folderId(SUB)).resolves.toBe(next);
  });

  it('passes over a folder moved to a shared drive, which no list shows', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const first = await folders.folderId(SUB);

    drive.files.get(first)!.driveId = 'team-drive';
    const next = await folders.folderId(SUB);

    expect(next).not.toBe(first);
    expect(checksOf(drive, first)).toHaveLength(1);
    await expect(folders.folderId(SUB)).resolves.toBe(next);
    await expect(tab(drive).folderId(SUB)).resolves.toBe(next);
    expect(checksOf(drive, first)).toHaveLength(1);
    expect(posts(drive)).toHaveLength(2);
  });

  it('forgets a folder found gone, so a lookup that fails after it asks for it no more', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const gone = await folders.folderId(SUB);
    drive.files.delete(gone);
    failGets(drive, isList);

    await expect(folders.folderId(SUB)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(checksOf(drive, gone)).toHaveLength(1);

    const fresh = await folders.folderId(SUB);
    expect(fresh).not.toBe(gone);
    expect(checksOf(drive, gone)).toHaveLength(1);
  });

  it('uses the folder it knows when the list fails, and lists again on the next use', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    const made = await folders.folderId(SUB);
    failGets(drive, isList);

    await expect(folders.folderId(SUB)).resolves.toBe(made);
    expect(checksOf(drive, made)).toHaveLength(1);

    drive.unlisted.clear();
    const listed = lists(drive).length;
    await expect(folders.folderId(SUB)).resolves.toBe(made);
    expect(lists(drive)).toHaveLength(listed + 1);
    expect(checksOf(drive, made)).toHaveLength(1);
    expect(posts(drive)).toHaveLength(1);
  });

  it('checks a folder it made while the list leaves it out, and moves to an older one the list then shows', async () => {
    const drive = createFakeDrive();
    drive.unlisted.add('created-folder-1');
    const first = tab(drive);
    const made = await first.folderId(SUB);
    expect(made).toBe('created-folder-1');

    // Another device, told nothing, whose list misses it too, makes a second.
    drive.unlisted.add('created-folder-2');
    const second = tab(drive);
    await expect(second.folderId(SUB)).resolves.toBe('created-folder-2');

    await expect(first.folderId(SUB)).resolves.toBe(made);
    expect(checksOf(drive, made)).toHaveLength(1);
    expect(posts(drive)).toHaveLength(2);

    drive.unlisted.clear();
    await expect(second.folderId(SUB)).resolves.toBe(made);
    await expect(first.folderId(SUB)).resolves.toBe(made);
    const settled = drive.calls.length;
    await expect(second.folderId(SUB)).resolves.toBe(made);
    await expect(first.folderId(SUB)).resolves.toBe(made);
    expect(drive.calls.slice(settled).every(call => isList(call.url))).toBe(
      true
    );
    expect(drive.calls).toHaveLength(settled + 2);
    expect(posts(drive)).toHaveLength(2);
  });

  it('tells the browser before letting go of the lock of a folder no list shows yet, and a tab told of it uses it', async () => {
    const drive = createFakeDrive();
    const { tabs, shared } = browserTabs(drive, 2);
    drive.unlisted.add('created-folder-1');

    const made = await tabs[0].folderId(SUB);
    expect(shared).toEqual([{ folderId: made, lockHeld: true }]);

    // Its list misses the folder too, as the next lock holder's might.
    await new Promise(resolve => setTimeout(resolve, 0));
    await expect(tabs[1].folderId(SUB)).resolves.toBe(made);
    expect(posts(drive)).toHaveLength(1);
    expect(checksOf(drive, made)).toHaveLength(1);

    drive.unlisted.clear();
    await expect(tabs[1].folderId(SUB)).resolves.toBe(made);
    await expect(tabs[0].folderId(SUB)).resolves.toBe(made);
    expect(shared).toHaveLength(2);
  });

  it('tells the browser of a folder it made though its own list shows it, since the next holder may list before Drive has caught up', async () => {
    const drive = createFakeDrive();
    const { tabs, shared } = browserTabs(drive, 2);
    // The third list, the second tab's: the first lists, creates and lists again.
    const release = drive.hold(
      'GET',
      url => isList(url) && lists(drive).length === 3
    );

    const first = tabs[0].folderId(SUB);
    const second = tabs[1].folderId(SUB);
    await expect(first).resolves.toBe('created-folder-1');
    expect(shared).toEqual([{ folderId: 'created-folder-1', lockHeld: true }]);
    await until(() => lists(drive).length === 3);
    await new Promise(resolve => setTimeout(resolve, 0));
    drive.unlisted.add('created-folder-1');
    release();

    await expect(second).resolves.toBe('created-folder-1');
    expect(posts(drive)).toHaveLength(1);
    expect(checksOf(drive, 'created-folder-1')).toHaveLength(1);
  });

  it('keeps a folder it made when the list after it fails, and lists again on the next use', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    const release = drive.hold('POST');
    const run = folders.folderId(SUB);
    await until(() => posts(drive).length === 1);
    failGets(drive, isList);
    release();

    await expect(run).resolves.toBe('created-folder-1');
    const listed = lists(drive).length;
    await expect(folders.folderId(SUB)).resolves.toBe('created-folder-1');
    expect(lists(drive)).toHaveLength(listed + 1);
    expect(posts(drive)).toHaveLength(1);
  });

  it('keeps nothing of a lookup another account signed in during, whatever call it overtook', async () => {
    let current = SUB;
    /** Holds the matching call and releases it once another account signs in. */
    const overtaken = async (
      drive: FakeDrive,
      folders: Tab,
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

    // A list that fails once another account signed in.
    drive.failNext('GET', 500, 'backendError', isList);
    await overtaken(drive, folders, 'GET', isList);

    // The check: another account's token finds no such folder, which is kept all the same.
    const id = 'created-folder-1';
    const folder = drive.files.get(id)!;
    drive.unlisted.add(id);
    const release = drive.hold('GET', url => !isList(url));
    const run = folders.folderId(SUB);
    await until(() => checksOf(drive, id).length === 1);
    current = '2002';
    drive.files.delete(id);
    release();
    await expect(run).rejects.toBeInstanceOf(AccountChangedError);

    current = SUB;
    drive.files.set(id, folder);
    await expect(folders.folderId(SUB)).resolves.toBe(id);
    expect(checksOf(drive, id)).toHaveLength(2);
    expect(posts(drive)).toHaveLength(1);
  });

  it('forgets a folder a check finds closed to it, as a revoked grant leaves one, and takes another', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    const id = await folders.folderId(SUB);
    drive.failNext('GET', 403, 'appNotAuthorizedToFile', url => !isList(url));

    const next = await folders.folderId(SUB);

    expect(next).not.toBe(id);
    expect(checksOf(drive, id)).toHaveLength(1);
    await expect(folders.folderId(SUB)).resolves.toBe(next);
    expect(checksOf(drive, id)).toHaveLength(1);
    expect(posts(drive)).toHaveLength(2);
  });

  it('passes on a check that keeps failing otherwise, and keeps the id for the next call', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    const id = await folders.folderId(SUB);
    failGets(drive, url => !isList(url));

    await expect(folders.folderId(SUB)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(checksOf(drive, id)).toHaveLength(RETRY_LIMIT + 1);
    await expect(folders.folderId(SUB)).resolves.toBe(id);
    expect(posts(drive)).toHaveLength(1);
  });

  it('reads again after a failure that may pass, the list and the check alike', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.unlisted.add('created-folder-1');
    drive.failNext('GET', 503, 'backendError', isList);

    await expect(folders.folderId(SUB)).resolves.toBe('created-folder-1');
    expect(lists(drive)).toHaveLength(3);

    drive.failNext('GET', 429, 'rateLimitExceeded', url => !isList(url));
    await expect(folders.folderId(SUB)).resolves.toBe('created-folder-1');
    expect(checksOf(drive, 'created-folder-1')).toHaveLength(2);
    expect(posts(drive)).toHaveLength(1);
  });

  it('passes on a failed create, and tries again on the next call', async () => {
    const drive = createFakeDrive();
    const folders = tab(drive);
    drive.failNext('POST', 500);

    await expect(folders.folderId(SUB)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(posts(drive)).toHaveLength(1);
    const id = await folders.folderId(SUB);
    expect(drive.files.get(id)?.name).toBe('ERD Editor');
  });

  it('passes on a failed first list when it knows no folder', async () => {
    const drive = createFakeDrive();
    failGets(drive, isList);

    await expect(tab(drive).folderId(SUB)).rejects.toMatchObject({
      kind: 'server',
    });
    expect(posts(drive)).toEqual([]);
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
