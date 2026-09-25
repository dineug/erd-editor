import {
  settingsActions,
  SharedFollowingActionTypes,
  tableActions,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  comparable,
  createDriveEnv,
  createPeerEditor,
  documentWith,
  type DriveEnv,
  openTab,
  settle,
  SUB,
  type Tab,
  tableNames,
  type TabOptions,
  USERS_DOCUMENT,
} from '@/__test-utils__/driveDocument';
import {
  createDocumentController,
  NO_LOCKS_JOIN_MS,
  NON_EDIT_ACTIONS,
  renameDriveFile,
} from '@/services/gdrive/documentController';
import {
  ACK_TIMEOUT_MS,
  CHECK_TIMEOUT_MS,
  fileChannelName,
  FLUSH_TIMEOUT_MS,
  FOLLOWER_SEND_WINDOW_MS,
  openFileChannel,
} from '@/services/gdrive/fileChannel';
import { fileLockName } from '@/services/gdrive/fileLeader';
import { STEAL_SETTLE_MS } from '@/services/gdrive/saveQueue';
import { toDriveFingerprint } from '@/utils/documentFingerprint';

/** A .vuerd file as the version 2 editor saved it: one table, users. */
const VERSION_2_DOCUMENT = JSON.stringify({
  canvas: { version: '2.0.0', width: 2000, height: 2000, databaseName: '' },
  table: {
    tables: [
      {
        id: 't1',
        name: 'users',
        comment: '',
        columns: [],
        ui: {
          active: false,
          left: 10,
          top: 20,
          zIndex: 1,
          widthName: 60,
          widthComment: 60,
        },
        visible: true,
      },
    ],
    edit: null,
    copyColumns: [],
    columnDraggable: null,
  },
  memo: { memos: [] },
  relationship: { relationships: [] },
});

/** Users, and a table the person removed, which the element's collector drops days on. */
const REMOVED_TABLE = (() => {
  let id = '';
  const value = documentWith(store => {
    store.setInitialValue(USERS_DOCUMENT);
    [id] = store.dispatch([tableActions$.addTableAction$()]).createdIds;
    store.dispatch([tableActions.removeTableAction({ id })]);
  });
  return { id, value };
})();

let env: DriveEnv;
const tabs: Tab[] = [];

async function open(name: string, options: Partial<TabOptions> = {}) {
  const tab = openTab(env, { name, ...options });
  tabs.push(tab);
  void tab.controller.open();
  await settle(20);
  return tab;
}

const driveContent = (fileId = 'file-1') =>
  env.drive.files.get(fileId)!.content;

const saveRequestsOf = (tab: string) =>
  env.sent.filter(
    ({ tab: from, message }) => from === tab && message.type === 'save-request'
  );

/** The other tabs apply an edit later, by their own clock, which stamps its entity meta. */
const deliverLater = () => vi.setSystemTime(Date.now() + 1000);

beforeEach(() => {
  vi.useFakeTimers();
  env = createDriveEnv();
  env.addFile();
});

afterEach(() => {
  tabs.splice(0).forEach(tab => tab.close());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('one tab', () => {
  it('leads, loads from Drive and saves an edit two seconds later', async () => {
    const a = await open('a');

    expect(a.snapshot()).toMatchObject({
      phase: 'ready',
      role: 'leader',
      name: 'shop.erd.json',
      canEdit: true,
      saveState: 'saved',
    });
    expect(tableNames(a.value())).toEqual(['users']);

    a.addTable('orders');
    await settle(1999);
    expect(env.patches()).toHaveLength(0);
    await settle(1);

    expect(env.patches()).toHaveLength(1);
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);
    expect(a.snapshot().saveState).toBe('saved');
    expect(a.controller.hasUnsavedChanges()).toBe(false);
  });

  it('saves what an editor left before its change came, once another attaches', async () => {
    const a = await open('a');
    // The element reports a change 200 ms on; a screen replaced it before then.
    const [id] = a.editor.store.dispatch([
      tableActions$.addTableAction$(),
    ]).createdIds;
    a.editor.store.dispatch([
      tableActions.changeTableNameAction({ id, value: 'orders' }),
    ]);
    expect(a.controller.hasUnsavedChanges()).toBe(true);
    await settle(2000);
    expect(env.patches()).toHaveLength(0);

    const next = createPeerEditor('a');
    a.editors.push(next);
    a.controller.attach(next.adapter);
    expect(tableNames(next.store.value)).toEqual(['orders', 'users']);
    await settle(2000);

    expect(env.patches()).toHaveLength(1);
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);
    expect(a.controller.hasUnsavedChanges()).toBe(false);
  });
});

describe('tabs of one file', () => {
  it('converge across three replicas, whichever tab edits', async () => {
    const a = await open('a');
    const b = await open('b');
    const c = await open('c');

    expect(b.snapshot()).toMatchObject({ phase: 'ready', role: 'follower' });
    expect(c.snapshot()).toMatchObject({ phase: 'ready', role: 'follower' });

    const orders = b.addTable('orders');
    await settle(5);
    c.edit([
      tableActions.changeTableNameAction({ id: orders, value: 'purchases' }),
    ]);
    await settle(5);
    a.addTable('items');
    await settle(5);

    expect(tableNames(a.value())).toEqual(['items', 'purchases', 'users']);
    expect(comparable(b.value())).toEqual(comparable(a.value()));
    expect(comparable(c.value())).toEqual(comparable(a.value()));

    await settle(10_000);
    expect(env.patches().map(env.tabOf)).toEqual(['a']);
    expect(toDriveFingerprint(driveContent())).toBe(
      toDriveFingerprint(a.value())
    );
  });
});

describe('leadership', () => {
  it('passes to the next tab when the leader closes, which saves what it left', async () => {
    const a = await open('a');
    const b = await open('b');

    a.addTable('orders');
    await settle(5);
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(5);

    expect(b.snapshot()).toMatchObject({ role: 'leader', saveState: 'saved' });
    expect(env.patches().map(env.tabOf)).toEqual(['b']);
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);

    b.addTable('items');
    await settle(2000);
    expect(env.patches().map(env.tabOf)).toEqual(['b', 'b']);
  });

  it('starts a new tab from the leader’s value, unsaved edits included, without reading Drive', async () => {
    const a = await open('a');
    a.addTable('orders');
    await settle(5);

    const c = await open('c');

    expect(tableNames(c.value())).toEqual(['orders', 'users']);
    expect(env.downloads().map(env.tabOf)).toEqual(['a']);
    expect(env.patches()).toHaveLength(0);
  });

  it('lets a tab take over saving from a leader that stopped answering', async () => {
    const a = await open('a');
    const b = await open('b');
    a.freeze();

    b.addTable('orders');
    await settle(2000 + 3000);
    expect(b.snapshot().saveState).toBe('waiting-leader');
    expect(env.patches()).toHaveLength(0);

    await b.controller.takeOver();
    await settle(5);

    expect(b.snapshot()).toMatchObject({ role: 'leader', saveState: 'saved' });
    expect(env.patches().map(env.tabOf)).toEqual(['b']);
    expect(a.snapshot().role).toBe('follower');
  });

  it('keeps a stolen leader from PATCHing once its metadata check comes back', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    // a reads the file before the steal and hears back after it.
    const answer = env.drive.holdAnswer('GET');
    await settle(2000);
    const check = env.drive.hold('GET');
    const taking = b.controller.takeOver();
    await settle(5);

    answer();
    await settle(5);
    expect(env.patches()).toHaveLength(0);

    check();
    await taking;
    await settle(20);
    expect(env.patches().map(env.tabOf)).toEqual(['b']);
    expect(a.snapshot().role).toBe('follower');
    expect(toDriveFingerprint(driveContent())).toBe(
      toDriveFingerprint(b.value())
    );
  });

  it('lets a stolen leader whose check came back late lead again with nothing stopped', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    const release = env.drive.hold('GET');
    await settle(2000);
    await b.controller.takeOver();
    // a's check reads b's save, which b has not told a of yet.
    release();
    await settle(20);
    expect(env.patches().map(env.tabOf)).toEqual(['b']);

    b.close();
    tabs.splice(tabs.indexOf(b), 1);
    await settle(5);

    expect(a.snapshot()).toMatchObject({ role: 'leader', saveState: 'saved' });
    a.addTable('items');
    await settle(2000);
    expect(env.patches().map(env.tabOf)).toEqual(['b', 'a']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
  });

  it('puts back what a stolen leader’s late PATCH overwrote', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    const release = env.drive.hold('PATCH');
    await settle(2000);
    // a has items too, but the PATCH it sent carries what it had before.
    b.addTable('items');
    await settle(5);

    const taking = b.controller.takeOver();
    await settle(STEAL_SETTLE_MS + 20);
    await taking;
    expect(env.patches().map(env.tabOf)).toEqual(['a', 'b']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);

    release();
    await settle(20);

    expect(env.patches().map(env.tabOf)).toEqual(['a', 'b', 'b']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
    expect(b.snapshot().saveState).toBe('saved');
  });

  it('hands off after a save with nothing left to save', async () => {
    const a = await open('a');
    const b = await open('b');
    b.addTable('orders');
    deliverLater();
    await settle(2100);
    expect(env.patches().map(env.tabOf)).toEqual(['a']);

    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(STEAL_SETTLE_MS);

    expect(b.snapshot()).toMatchObject({ role: 'leader', saveState: 'saved' });
    expect(b.controller.hasUnsavedChanges()).toBe(false);
    expect(env.patches()).toHaveLength(1);
  });

  it('takes the snapshot a leader still loading sends after the hellos gave up, and steals nothing', async () => {
    const a = await open('a', { autoAttach: false });
    const b = await open('b');
    await settle(7500);
    expect(b.snapshot().phase).toBe('waiting-snapshot');

    a.mount();
    await settle(20);

    expect(b.snapshot()).toMatchObject({
      phase: 'ready',
      role: 'follower',
      saveState: 'saved',
      epoch: a.snapshot().epoch,
    });
    expect(a.snapshot().role).toBe('leader');
    expect(env.locks.calls.some(call => call.options.steal)).toBe(false);
    b.addTable('orders');
    await settle(5);
    expect(tableNames(a.value())).toEqual(['orders', 'users']);
  });

  it('installs nothing from a load a takeover overtook', async () => {
    const release = env.drive.hold(
      'GET',
      url => url.searchParams.get('alt') === 'media'
    );
    const a = await open('a');
    const b = await open('b');
    await settle(7500);
    expect(a.snapshot().phase).toBe('loading');
    expect(b.snapshot().phase).toBe('waiting-snapshot');

    const taking = b.controller.takeOver();
    await settle(20);
    await taking;
    const { epoch } = b.snapshot();
    expect(a.snapshot()).toMatchObject({ phase: 'ready', role: 'follower' });
    expect(a.snapshot().epoch).toBe(epoch);

    release();
    await settle(20);

    expect(a.snapshot()).toMatchObject({ role: 'follower', epoch });
    a.addTable('orders');
    await settle(5);
    expect(tableNames(b.value())).toEqual(['orders', 'users']);
  });

  it('waits after a takeover for the save the old leader announced', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    const release = env.drive.hold('PATCH');
    await settle(2005);

    const taking = b.controller.takeOver();
    b.addTable('items');
    await settle(1000);
    expect(env.patches().map(env.tabOf)).toEqual(['a']);

    release();
    await settle(20);
    await taking;

    expect(env.patches().map(env.tabOf)).toEqual(['a', 'b']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
    expect(b.snapshot()).toMatchObject({ role: 'leader', saveState: 'saved' });
  });
});

describe('after a takeover', () => {
  it('holds the new leader’s saves until it has checked on the attempt it took over', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    const release = env.drive.hold('PATCH');
    await settle(2005);
    a.freeze();

    const taking = b.controller.takeOver();
    b.addTable('items');
    await settle(3000);
    expect(env.patches().map(env.tabOf)).toEqual(['a']);

    // The old PATCH lands three seconds into the wait, and its saved never comes.
    release();
    await settle(STEAL_SETTLE_MS);
    await taking;

    expect(b.snapshot()).toMatchObject({
      role: 'leader',
      saveState: 'unconfirmed',
    });
    expect(env.patches().map(env.tabOf)).toEqual(['a']);
    expect(await b.controller.checkUnconfirmed()).toBe('resumed');
    await settle(20);
    expect(b.snapshot().saveState).toBe('saved');
    expect(env.patches().map(env.tabOf)).toEqual(['a', 'b']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
  });
});

describe('a remote change', () => {
  it('stops every tab with a conflict and sends no PATCH', async () => {
    const a = await open('a');
    const b = await open('b');
    env.drive.bumpRemote('file-1');

    b.addTable('orders');
    await settle(2100);

    expect(a.snapshot().saveState).toBe('conflict');
    expect(b.snapshot().saveState).toBe('conflict');
    expect(env.patches()).toHaveLength(0);
    expect(b.controller.hasUnsavedChanges()).toBe(true);
  });

  it('downloads my changes as the editor holds them', async () => {
    const a = await open('a');
    const b = await open('b');
    env.drive.bumpRemote('file-1');
    b.addTable('orders');
    await settle(2100);

    b.controller.downloadChanges();

    expect(b.downloads).toEqual([{ fileName: 'shop.erd', text: b.value() }]);
    expect(tableNames(b.downloads[0].text)).toEqual(['orders', 'users']);
    a.controller.downloadChanges();
    expect(a.downloads[0].text).toBe(a.value());
  });

  it('reloads from Drive in every tab, from a follower’s click, and saves again', async () => {
    const a = await open('a');
    const b = await open('b');
    env.drive.bumpRemote(
      'file-1',
      driveContent().replace('"users"', '"people"')
    );
    b.addTable('orders');
    await settle(2100);
    expect(a.snapshot().saveState).toBe('conflict');
    const epoch = a.snapshot().epoch;

    await b.controller.reload();
    await settle(20);

    expect(a.snapshot()).toMatchObject({ saveState: 'saved', phase: 'ready' });
    expect(a.snapshot().epoch).not.toBe(epoch);
    expect(b.snapshot().epoch).toBe(a.snapshot().epoch);
    expect(tableNames(a.value())).toEqual(['people']);
    expect(tableNames(b.value())).toEqual(['people']);

    b.addTable('orders');
    await settle(2100);
    expect(env.patches().map(env.tabOf)).toEqual(['a']);
    expect(tableNames(driveContent())).toEqual(['orders', 'people']);
  });
});

describe('a save nobody confirmed', () => {
  it('stops the next leader as unconfirmed when the old one died after its PATCH', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    const release = env.drive.hold('PATCH');
    // b hears of the attempt; then the PATCH lands and a dies before saying so.
    await settle(2005);
    release();
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(20);
    b.addTable('items');
    await settle(2000);

    expect(b.snapshot()).toMatchObject({
      role: 'leader',
      saveState: 'unconfirmed',
    });
    expect(env.patches().map(env.tabOf)).toEqual(['a']);
  });

  it('resumes after Check Drive finds the attempt landed, from any tab', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    env.drive.loseNextResponse('PATCH');
    await settle(2000 + 1000 + 20);
    expect(a.snapshot().saveState).toBe('unconfirmed');
    expect(b.snapshot().saveState).toBe('unconfirmed');
    expect(env.patches()).toHaveLength(1);

    const checked = b.controller.checkUnconfirmed();
    await settle(20);

    expect(await checked).toBe('resumed');
    expect(a.snapshot().saveState).toBe('saved');
    expect(b.snapshot().saveState).toBe('saved');
    b.addTable('items');
    await settle(2100);
    expect(env.patches().map(env.tabOf)).toEqual(['a', 'a']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
  });

  it('tells a follower when the leader could not reach Drive, or never answered', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    env.drive.loseNextResponse('PATCH');
    await settle(2000 + 1000 + 20);
    expect(b.snapshot().saveState).toBe('unconfirmed');

    env.drive.failNext('GET', 500);
    const failed = b.controller.checkUnconfirmed();
    await settle(20);
    expect(await failed).toBe('failed');
    expect(b.snapshot().saveState).toBe('unconfirmed');

    a.freeze();
    const unanswered = b.controller.checkUnconfirmed();
    await settle(CHECK_TIMEOUT_MS);
    expect(await unanswered).toBe('failed');
  });

  it('checks in a follower elected while it waited, and skips in one that closed', async () => {
    const a = await open('a');
    const b = await open('b');
    const c = await open('c');
    a.addTable('orders');
    env.drive.loseNextResponse('PATCH');
    await settle(2000 + 1000 + 20);
    a.freeze();

    const checked = b.controller.checkUnconfirmed();
    const closed = c.controller.checkUnconfirmed();
    c.close();
    tabs.splice(tabs.indexOf(c), 1);
    expect(await closed).toBe('skipped');
    expect(await c.controller.checkUnconfirmed()).toBe('skipped');
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(20);

    expect(b.snapshot().role).toBe('leader');
    expect(await checked).toBe('resumed');
    expect(b.snapshot().saveState).toBe('saved');
  });

  it('turns into a conflict when Drive holds something else', async () => {
    const a = await open('a');
    a.addTable('orders');
    env.drive.loseNextResponse('PATCH');
    await settle(2000);
    env.drive.bumpRemote('file-1', driveContent().replace('"orders"', '"x"'));
    await settle(1020);
    expect(a.snapshot().saveState).toBe('unconfirmed');

    expect(await a.controller.checkUnconfirmed()).toBe('conflict');
    expect(a.snapshot().saveState).toBe('conflict');
  });
});

describe('rename', () => {
  it('waits for the save under way when a follower asks, so the next save is no conflict', async () => {
    const a = await open('a');
    const b = await open('b');
    a.addTable('orders');
    const release = env.drive.hold('PATCH');
    await settle(2000);

    const renamed = b.controller.rename('store.erd.json');
    await settle(20);
    expect(env.drive.files.get('file-1')!.name).toBe('shop.erd.json');

    release();
    await settle(20);
    const result = await renamed;

    expect(result.name).toBe('store.erd.json');
    expect(env.drive.files.get('file-1')!.name).toBe('store.erd.json');
    expect(a.snapshot().name).toBe('store.erd.json');
    expect(b.snapshot().name).toBe('store.erd.json');

    b.addTable('items');
    await settle(2100);
    expect(a.snapshot().saveState).toBe('saved');
    expect(env.patches()).toHaveLength(2);
  });

  it('renames in the leader’s own tab and tells the others', async () => {
    const a = await open('a');
    const b = await open('b');

    const renaming = a.controller.rename('store.erd.json');
    await settle(5);
    await renaming;

    expect(b.snapshot().name).toBe('store.erd.json');
    a.addTable('orders');
    await settle(2000);
    expect(a.snapshot().saveState).toBe('saved');
  });

  it('reports a rename Drive refused to the tab that asked', async () => {
    await open('a');
    const b = await open('b');
    env.drive.files.get('file-1')!.canRename = false;

    const failed = expect(
      b.controller.rename('store.erd.json')
    ).rejects.toThrow('The file could not be renamed');
    await settle(20);
    await failed;
  });

  it('goes through the leader of a file open elsewhere', async () => {
    const a = await open('a');

    const renaming = renameDriveFile(
      {
        drive: env.clientFor('sidebar'),
        locks: env.locks,
        createChannel: env.hub.create,
        sub: SUB,
      },
      'file-1',
      'store.erd.json'
    );
    await settle(20);
    const result = await renaming;

    expect(result.name).toBe('store.erd.json');
    expect(a.snapshot().name).toBe('store.erd.json');
    const renames = env.drive
      .callsTo('PATCH')
      .filter(call => call.url.pathname === '/drive/v3/files/file-1');
    expect(renames.map(env.tabOf)).toEqual(['a']);
  });

  it('renames a file no tab has open at once', async () => {
    const result = await renameDriveFile(
      {
        drive: env.clientFor('sidebar'),
        locks: env.locks,
        createChannel: env.hub.create,
        sub: SUB,
      },
      'file-1',
      'store.erd.json'
    );

    expect(result.name).toBe('store.erd.json');
    expect(env.hub.posted).toHaveLength(0);
  });

  it('asks the tabs first without Web Locks, and renames at once when none answers', async () => {
    const renaming = renameDriveFile(
      {
        drive: env.clientFor('sidebar'),
        locks: null,
        createChannel: env.hub.create,
        sub: SUB,
      },
      'file-1',
      'store.erd.json'
    );
    await settle(1999);
    expect(env.drive.files.get('file-1')!.name).toBe('shop.erd.json');
    await settle(1);

    expect((await renaming).name).toBe('store.erd.json');
  });

  it('hands the rename to a tab without Web Locks that answers', async () => {
    const a = await open('a', { locks: null });
    await settle(NO_LOCKS_JOIN_MS);

    const renaming = renameDriveFile(
      {
        drive: env.clientFor('sidebar'),
        locks: null,
        createChannel: env.hub.create,
        sub: SUB,
      },
      'file-1',
      'store.erd.json'
    );
    await settle(20);

    expect((await renaming).name).toBe('store.erd.json');
    expect(a.snapshot().name).toBe('store.erd.json');
  });

  describe('asked while the leader still loads', () => {
    const isDownload = (url: URL) => url.searchParams.get('alt') === 'media';

    /** Tab a leads and waits for its download; the sidebar of a renames meanwhile. */
    async function renameWhileLoading() {
      const release = env.drive.hold('GET', isDownload);
      const a = openTab(env, { name: 'a' });
      tabs.push(a);
      void a.controller.open();
      await settle(20);
      expect(a.snapshot().phase).toBe('loading');
      expect(env.locks.isHeld(fileLockName(SUB, 'file-1'))).toBe(true);
      const renaming = renameDriveFile(
        {
          drive: env.clientFor('sidebar'),
          locks: env.locks,
          createChannel: env.hub.create,
          sub: SUB,
        },
        'file-1',
        'store.erd.json'
      );
      await settle(20);
      return { a, release, renaming };
    }

    it('renames once the leader has the document', async () => {
      const { a, release, renaming } = await renameWhileLoading();
      expect(env.drive.files.get('file-1')!.name).toBe('shop.erd.json');

      release();
      await settle(20);

      expect((await renaming).name).toBe('store.erd.json');
      expect(a.snapshot()).toMatchObject({
        phase: 'ready',
        name: 'store.erd.json',
      });
      a.addTable('orders');
      await settle(2000);
      expect(a.snapshot().saveState).toBe('saved');
      expect(env.patches()).toHaveLength(1);
    });

    it('says it could not once the load fails', async () => {
      const { release, renaming } = await renameWhileLoading();
      const failed = expect(renaming).rejects.toThrow(
        'The file could not be renamed'
      );
      env.drive.failNext('GET', 404, 'notFound', isDownload);

      release();
      await settle(20);

      await failed;
      expect(env.drive.files.get('file-1')!.name).toBe('shop.erd.json');
    });

    it('says it could not once the leader closes', async () => {
      const { a, renaming } = await renameWhileLoading();
      const failed = expect(renaming).rejects.toThrow(
        'The file could not be renamed'
      );

      a.close();
      tabs.splice(tabs.indexOf(a), 1);
      await settle(20);

      await failed;
    });
  });

  it('gives up on a leader that never answers', async () => {
    const a = await open('a');
    a.freeze();

    const renaming = renameDriveFile(
      {
        drive: env.clientFor('sidebar'),
        locks: env.locks,
        createChannel: env.hub.create,
        sub: SUB,
      },
      'file-1',
      'store.erd.json'
    );
    const failed = expect(renaming).rejects.toThrow('did not answer');
    await settle(30_000);
    await failed;
  });
});

describe('what a file is', () => {
  it('opens a version 2 file as version 3, saving nothing until an edit, then version 3 under its name', async () => {
    env.drive.files.delete('file-1');
    env.addFile({ name: 'legacy.vuerd', content: VERSION_2_DOCUMENT });
    const a = await open('a');

    expect(tableNames(a.value())).toEqual(['users']);
    await settle(10_000);
    expect(env.patches()).toHaveLength(0);

    a.addTable('orders');
    await settle(2000);

    const [patch] = env.patches();
    expect(JSON.parse(patch.body!).version).toBe('3.0.0');
    expect(env.drive.files.get('file-1')!.name).toBe('legacy.vuerd');
    expect(
      env.drive
        .callsTo('PATCH')
        .filter(call => call.url.pathname === '/drive/v3/files/file-1')
    ).toHaveLength(0);
  });

  it.each([
    ['another tool’s JSON', '{"entities":[]}'],
    ['no JSON at all', 'erd designer 1.0'],
  ])('opens no editor for %s, and lets the lock go', async (_name, content) => {
    env.drive.files.delete('file-1');
    env.addFile({ name: 'model.erd', content });

    const a = await open('a');

    expect(a.snapshot()).toMatchObject({
      phase: 'rejected',
      rejection: 'not-document',
      role: null,
    });
    expect(a.editors).toHaveLength(0);
    expect(env.locks.isHeld(fileLockName(SUB, 'file-1'))).toBe(false);
    await settle(10_000);
    expect(env.patches()).toHaveLength(0);
  });

  it.each([
    ['trashed', { trashed: true }],
    ['google-native', { mimeType: 'application/vnd.google-apps.document' }],
    ['too-large', { size: 64 * 1024 * 1024 + 1 }],
  ])(
    'turns away a file that is %s before reading it',
    async (rejection, file) => {
      env.drive.files.delete('file-1');
      env.addFile(file);

      const a = await open('a');

      expect(a.snapshot()).toMatchObject({ phase: 'rejected', rejection });
      expect(env.downloads()).toHaveLength(0);
    }
  );

  it('says a file is not found when Drive has none, or shows it to nobody here', async () => {
    env.drive.files.delete('file-1');
    expect((await open('a')).snapshot().phase).toBe('not-found');

    env.addFile();
    env.drive.failNext('GET', 403, 'forbidden');
    expect((await open('b')).snapshot().phase).toBe('not-found');
  });

  it('fails an open whose metadata Drive refuses', async () => {
    env.drive.failNext('GET', 400, 'badRequest');

    expect((await open('a')).snapshot().phase).toBe('failed');
  });

  it('fails an open whose content Drive refuses, and lets the lock go', async () => {
    env.drive.failNext(
      'GET',
      400,
      'badRequest',
      url => url.searchParams.get('alt') === 'media'
    );

    const a = await open('a');

    expect(a.snapshot()).toMatchObject({ phase: 'failed', role: null });
    expect(env.locks.isHeld(fileLockName(SUB, 'file-1'))).toBe(false);
  });

  it('opens a file this account may only read as read-only and saves nothing', async () => {
    env.drive.files.get('file-1')!.canEdit = false;
    const a = await open('a');
    const b = await open('b');

    expect(a.snapshot()).toMatchObject({
      canEdit: false,
      saveState: 'readonly',
      accessLost: false,
    });
    expect(b.snapshot()).toMatchObject({
      canEdit: false,
      saveState: 'readonly',
      accessLost: false,
    });
    b.addTable('orders');
    await settle(10_000);
    expect(env.patches()).toHaveLength(0);
  });

  it('stops every tab with its edits when a save finds edit access gone, and downloads them once closed', async () => {
    const a = await open('a');
    const b = await open('b');
    env.drive.files.get('file-1')!.canEdit = false;

    b.addTable('orders');
    await settle(2100);

    for (const tab of [a, b]) {
      expect(tab.snapshot()).toMatchObject({
        canEdit: false,
        saveState: 'readonly',
        accessLost: true,
      });
    }
    expect(env.patches()).toHaveLength(0);
    expect(a.controller.hasUnsavedChanges()).toBe(true);
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    a.controller.downloadChanges();
    expect(tableNames(a.downloads[0].text)).toEqual(['orders', 'users']);
  });
});

describe('what the element does on its own', () => {
  it('saves nothing for the tombstones it collects after a load, nor for a zoom', async () => {
    env.drive.files.delete('file-1');
    env.addFile({ content: REMOVED_TABLE.value });
    const a = await open('a');
    await settle(5);

    // The collector answers from its shared worker a macrotask or more later.
    delete a.editor.store.state.collections.tableEntities[REMOVED_TABLE.id];
    a.edit([settingsActions.changeZoomLevelAction({ value: 0.5 })]);
    await settle(10_000);

    expect(JSON.parse(a.value()).collections.tableEntities).not.toHaveProperty(
      REMOVED_TABLE.id
    );
    expect(env.patches()).toHaveLength(0);
    expect(a.controller.hasUnsavedChanges()).toBe(false);
  });

  it('gives an editor attached again in one load the document the last one left', async () => {
    const a = await open('a', { autoAttach: false });
    const first = createPeerEditor('first');
    const second = createPeerEditor('second');
    const detachFirst = a.controller.attach(first.adapter);
    await settle(5);
    first.addTable('orders');
    await settle(2000);
    expect(env.patches()).toHaveLength(1);

    detachFirst();
    a.controller.attach(second.adapter);
    await settle(5);

    expect(tableNames(second.store.value)).toEqual(['orders', 'users']);
    expect(a.controller.hasUnsavedChanges()).toBe(false);
    second.addTable('items');
    await settle(2000);
    expect(env.patches()).toHaveLength(2);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
    first.destroy();
    second.destroy();
  });
});

describe('the page around it', () => {
  it('saves at once when the leader’s page goes hidden', async () => {
    const page = new EventTarget() as EventTarget & {
      visibilityState: DocumentVisibilityState;
    };
    page.visibilityState = 'visible';
    const a = await open('a', { document: page });

    a.addTable('orders');
    page.visibilityState = 'hidden';
    page.dispatchEvent(new Event('visibilitychange'));
    await settle(5);

    expect(env.patches()).toHaveLength(1);
  });

  it('holds the edits while the fallback token has run out, and saves them once reconnected', async () => {
    const listeners = new Set<() => void>();
    const tokenSnapshot = { status: 'fallback-expired' };
    const tokens = {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot: () => tokenSnapshot,
    } as unknown as TabOptions['tokens'];
    const a = await open('a', { tokens });
    env.tokenStatus.current = 'fallback-expired';

    a.addTable('orders');
    await settle(2000);
    a.addTable('items');
    await settle(10_000);
    expect(a.snapshot().saveState).toBe('paused');
    expect(env.patches()).toHaveLength(0);

    env.tokenStatus.current = null;
    tokenSnapshot.status = 'fallback';
    listeners.forEach(listener => listener());
    await settle(5);

    expect(env.patches()).toHaveLength(1);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
  });

  it('has a follower ask before closing right after a press, before any change comes', async () => {
    await open('a');
    const b = await open('b');
    expect(b.controller.hasUnsavedChanges()).toBe(false);

    b.editor.press();
    expect(b.controller.hasUnsavedChanges()).toBe(true);
    await settle(FOLLOWER_SEND_WINDOW_MS);
    expect(b.controller.hasUnsavedChanges()).toBe(false);
    expect(env.patches()).toHaveLength(0);
  });

  it("counts another tab's edit as no follower's own: nothing unsaved, no save-request", async () => {
    const a = await open('a');
    const b = await open('b');

    a.addTable('orders');
    await settle(5);

    expect(tableNames(b.value())).toEqual(['orders', 'users']);
    expect(b.controller.hasUnsavedChanges()).toBe(false);
    await settle(2005);
    expect(saveRequestsOf('b')).toHaveLength(0);
    expect(env.patches()).toHaveLength(1);
  });

  it('asks for no save after a follower zooms', async () => {
    await open('a');
    const b = await open('b');

    b.edit([settingsActions.changeZoomLevelAction({ value: 0.5 })]);

    expect(b.controller.hasUnsavedChanges()).toBe(false);
    await settle(10_000);
    expect(saveRequestsOf('b')).toHaveLength(0);
    expect(env.patches()).toHaveLength(0);
  });

  it('counts nothing a follower does on a file it may not edit', async () => {
    env.drive.files.get('file-1')!.canEdit = false;
    await open('a');
    const b = await open('b');

    b.editor.press();
    b.addTable('orders');

    expect(b.controller.hasUnsavedChanges()).toBe(false);
    await settle(10_000);
    expect(saveRequestsOf('b')).toHaveLength(0);
  });

  it('takes every view action a replica follows for no edit', () => {
    for (const type of SharedFollowingActionTypes) {
      expect(NON_EDIT_ACTIONS.has(type)).toBe(true);
    }
  });

  it('flushes before a switch, in the leader and in a follower', async () => {
    const a = await open('a');
    const b = await open('b');

    a.addTable('orders');
    expect(a.controller.hasUnsavedChanges()).toBe(true);
    expect(await a.controller.flush()).toBe(true);
    expect(env.patches()).toHaveLength(1);

    b.addTable('items');
    const release = env.drive.hold('PATCH');
    let flushed: boolean | null = null;
    void b.controller.flush().then(saved => (flushed = saved));
    await settle(600);
    // The leader acked and is saving: the follower waits for the save itself.
    expect(env.patches()).toHaveLength(2);
    expect(flushed).toBeNull();

    release();
    await settle(20);
    expect(flushed).toBe(true);
    expect(env.patches().map(env.tabOf)).toEqual(['a', 'a']);
    expect(tableNames(driveContent())).toEqual(['items', 'orders', 'users']);
    await settle(10_000);
    expect(env.patches()).toHaveLength(2);
  });

  it('reports a follower’s flush the leader acked but could not save', async () => {
    const a = await open('a');
    const b = await open('b');
    b.addTable('orders');
    env.drive.failNext('PATCH', 400, 'badRequest');

    const flushed = b.controller.flush();
    await settle(600);

    expect(await flushed).toBe(false);
    expect(a.snapshot().saveState).toBe('failed');
    expect(b.snapshot().saveState).toBe('failed');
  });

  it('gives up on a leader that acked a flush and never finished', async () => {
    const a = await open('a');
    const b = await open('b');
    b.addTable('orders');
    env.drive.hold('PATCH');

    const flushed = b.controller.flush();
    await settle(600);
    a.freeze();
    await settle(FLUSH_TIMEOUT_MS);

    expect(await flushed).toBe(false);
  });

  it('answers a flush in a tab elected while it waited as its leader would', async () => {
    const a = await open('a');
    const b = await open('b');
    b.addTable('orders');
    a.freeze();

    const flushed = b.controller.flush();
    await settle(600);
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(5);

    expect(b.snapshot().role).toBe('leader');
    expect(await flushed).toBe(true);
    expect(env.patches().map(env.tabOf)).toEqual(['b']);
  });

  it('reports a follower whose leader does not ack a flush', async () => {
    const a = await open('a');
    const b = await open('b');
    a.freeze();

    const flushed = b.controller.flush();
    await settle(3000);

    expect(await flushed).toBe(false);
  });

  it('flushes nothing before a document is open', async () => {
    const a = openTab(env, { name: 'a' });
    tabs.push(a);

    expect(await a.controller.flush()).toBe(true);
    expect(a.controller.hasUnsavedChanges()).toBe(false);
    expect(() => a.controller.attach(createPeerEditor('x').adapter)).toThrow();
  });

  it('lets go of its lock and its channel when closed', async () => {
    const a = await open('a');
    const b = await open('b');

    b.close();
    tabs.splice(tabs.indexOf(b), 1);
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(5);

    expect(env.locks.isHeld(fileLockName(SUB, 'file-1'))).toBe(false);
    expect(env.hub.openCount(fileChannelName(SUB, 'file-1'))).toBe(0);
  });
});

describe('without Web Locks', () => {
  async function openAlone(name: string, options: Partial<TabOptions> = {}) {
    const tab = await open(name, { locks: null, ...options });
    await settle(NO_LOCKS_JOIN_MS);
    return tab;
  }

  it('joins another tab’s document, so both share edits', async () => {
    const a = await open('a', { locks: null });
    const b = openTab(env, { name: 'b', locks: null });
    tabs.push(b);
    void b.controller.open();
    await settle(NO_LOCKS_JOIN_MS + 20);

    expect(b.snapshot()).toMatchObject({ phase: 'ready', role: 'leader' });
    expect(env.downloads().map(env.tabOf)).toEqual(['a']);

    b.addTable('orders');
    await settle(5);
    expect(tableNames(a.value())).toEqual(['orders', 'users']);
  });

  it('saves one edit once, however long both tabs stay open', async () => {
    const a = await openAlone('a');
    const b = await openAlone('b');
    expect(b.snapshot().epoch).toBe(a.snapshot().epoch);

    b.addTable('orders');
    deliverLater();
    await settle(30_000);

    expect(env.patches()).toHaveLength(1);
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);
    expect(a.snapshot().saveState).toBe('saved');
    expect(b.snapshot().saveState).toBe('saved');
    expect(a.controller.hasUnsavedChanges()).toBe(false);
  });

  it('takes a snapshot that comes after it loaded Drive alone, before any edit', async () => {
    const a = await openAlone('a', { autoAttach: false });
    const b = await openAlone('b');
    const alone = b.snapshot().epoch;
    expect(b.snapshot().phase).toBe('ready');
    expect(env.downloads().map(env.tabOf)).toEqual(['a', 'b']);

    // The answer a background tab's throttled timer held back.
    a.mount();
    await settle(20);

    expect(b.snapshot().epoch).not.toBe(alone);
    expect(b.snapshot().epoch).toBe(a.snapshot().epoch);
    b.addTable('orders');
    await settle(5);
    expect(tableNames(a.value())).toEqual(['orders', 'users']);
  });

  it('keeps a load it already handed to another tab', async () => {
    const a = await openAlone('a', { autoAttach: false });
    const b = await openAlone('b');
    const c = await openAlone('c');
    expect(c.snapshot().epoch).toBe(b.snapshot().epoch);

    a.mount();
    await settle(20);

    expect(b.snapshot().epoch).not.toBe(a.snapshot().epoch);
    expect(c.snapshot().epoch).toBe(b.snapshot().epoch);
    c.addTable('orders');
    await settle(5);
    expect(tableNames(b.value())).toEqual(['orders', 'users']);
  });

  it('has one tab carry out a rename asked for from outside', async () => {
    const a = await openAlone('a');
    const b = await openAlone('b');

    const renaming = renameDriveFile(
      {
        drive: env.clientFor('sidebar'),
        locks: null,
        createChannel: env.hub.create,
        sub: SUB,
      },
      'file-1',
      'store.erd.json'
    );
    await settle(20);

    expect((await renaming).name).toBe('store.erd.json');
    const renames = env.drive
      .callsTo('PATCH')
      .filter(call => call.url.pathname === '/drive/v3/files/file-1');
    expect(renames).toHaveLength(1);
    expect(a.snapshot().name).toBe('store.erd.json');
    expect(b.snapshot().name).toBe('store.erd.json');

    b.addTable('orders');
    deliverLater();
    await settle(30_000);
    expect(a.snapshot().saveState).toBe('saved');
    expect(b.snapshot().saveState).toBe('saved');
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);
  });

  it('keeps a load it edited, and never saves over another load’s save', async () => {
    const a = await openAlone('a', { autoAttach: false });
    const b = await openAlone('b');
    b.addTable('orders');
    a.mount();
    await settle(20);
    expect(b.snapshot().epoch).not.toBe(a.snapshot().epoch);

    await settle(10_000);
    expect(env.patches().map(env.tabOf)).toEqual(['b']);
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);

    a.addTable('items');
    await settle(2100);
    expect(a.snapshot().saveState).toBe('conflict');
    expect(env.patches()).toHaveLength(1);
    expect(tableNames(driveContent())).toEqual(['orders', 'users']);
  });
});

describe('presence', () => {
  it('keeps the trackers of one person’s editors off the file’s channel', async () => {
    const a = await open('a', { presence: true });
    const b = await open('b', { presence: true });

    b.addTable('orders');
    await settle(30_000);

    const sent = env.sent
      .filter(({ message }) => message.type === 'actions')
      .flatMap(({ message }) => message.actions.map(({ type }: any) => type));
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.filter(type => /^editor\.shared.*Tracker$/.test(type))).toEqual(
      []
    );
    expect(tableNames(a.value())).toEqual(['orders', 'users']);
    const { editor } = a.editor.store.state;
    expect(editor.sharedFocusTrackerMap).toEqual({});
    expect(editor.sharedMouseTrackerMap).toEqual({});
  });
});

describe('edges of a tab’s life', () => {
  it('keeps the document when a reload cannot read Drive', async () => {
    const a = await open('a');
    const { epoch } = a.snapshot();

    env.drive.failNext('GET', 400, 'badRequest');
    const failed = a.controller.reload();
    await settle(5);
    expect(await failed).toBe(false);

    env.drive.bumpRemote('file-1', 'no longer a document');
    const refused = a.controller.reload();
    await settle(5);
    expect(await refused).toBe(false);

    expect(a.snapshot()).toMatchObject({ phase: 'ready', epoch });
    expect(tableNames(a.value())).toEqual(['users']);
  });

  it('gives every tab that waited the document one of them took over', async () => {
    env.locks
      .request(fileLockName(SUB, 'file-1'), {}, () => new Promise(() => {}))
      .catch(() => {});
    const b = await open('b');
    const c = await open('c');
    await settle(7500);
    expect(c.snapshot().phase).toBe('waiting-snapshot');

    const taking = b.controller.takeOver();
    await settle(20);
    await taking;

    expect(c.snapshot()).toMatchObject({
      phase: 'ready',
      role: 'follower',
      epoch: b.snapshot().epoch,
    });
    c.addTable('orders');
    await settle(5);
    expect(tableNames(b.value())).toEqual(['orders', 'users']);
    expect(env.downloads().map(env.tabOf)).toEqual(['b']);
  });

  it('leaves a tab that could not open the file alone on another’s reload', async () => {
    env.drive.failNext('GET', 404, 'notFound');
    const x = await open('x');
    const a = await open('a');
    expect(x.snapshot().phase).toBe('not-found');

    const reloading = a.controller.reload();
    await settle(20);
    await reloading;

    expect(x.snapshot()).toMatchObject({ phase: 'not-found', role: null });
  });

  it('answers only while an editor is attached, and a stale detach does nothing', async () => {
    const a = await open('a', { autoAttach: false });
    const first = createPeerEditor('first');
    const second = createPeerEditor('second');
    const hello = openFileChannel(
      env.hub.create,
      fileChannelName(SUB, 'file-1'),
      () => null
    );
    const heard: string[] = [];
    hello.subscribe(message => {
      if (message.type !== 'actions') heard.push(message.type);
    });

    const detachFirst = a.controller.attach(first.adapter);
    detachFirst();
    hello.post({ type: 'hello', from: 'raw' });
    await settle(5);
    expect(heard).toEqual(['status']);
    expect(a.controller.hasUnsavedChanges()).toBe(false);

    const detachSecond = a.controller.attach(second.adapter);
    await settle(5);
    expect(heard).toEqual(['status', 'snapshot', 'status']);
    detachFirst();
    second.addTable('orders');
    await settle(2000);
    expect(env.patches()).toHaveLength(1);

    detachSecond();
    detachSecond();
    first.destroy();
    second.destroy();
  });

  it('answers once mounted when elected before its editor was', async () => {
    const a = await open('a');
    const b = await open('b', { autoAttach: false });
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(5);
    expect(b.snapshot().role).toBe('leader');

    const c = await open('c');
    expect(c.snapshot().phase).toBe('loading');
    b.mount();
    await settle(5);

    expect(c.snapshot()).toMatchObject({ phase: 'ready', role: 'follower' });
  });

  it('tells the other tabs of a PATCH Drive refused, so none waits on it', async () => {
    const a = await open('a');
    const b = await open('b');
    // b takes the edit from a and asks for no save of its own.
    env.drive.failNext('PATCH', 400, 'badRequest');
    a.addTable('orders');
    await settle(2005);
    expect(a.snapshot().saveState).toBe('failed');
    expect(env.patches()).toHaveLength(1);

    env.drive.bumpRemote('file-1');
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    await settle(5);

    // An attempt still pending would read the remote change as unconfirmed.
    expect(b.snapshot()).toMatchObject({
      role: 'leader',
      saveState: 'conflict',
    });
  });

  it('stops opening once closed', async () => {
    const release = env.drive.hold('GET');
    const a = openTab(env, { name: 'a' });
    void a.controller.open();
    a.close();
    release();
    await settle(20);

    expect(a.snapshot().phase).toBe('loading');
    expect(env.locks.calls).toHaveLength(0);

    const failing = env.drive.hold('GET');
    env.drive.failNext('GET', 404, 'notFound');
    const b = openTab(env, { name: 'b' });
    void b.controller.open();
    b.close();
    failing();
    await settle(20);
    expect(b.snapshot().phase).toBe('loading');
  });

  it('lets go of a lock it won after it was closed', async () => {
    const tab: { current: Tab | null } = { current: null };
    const locks = {
      request: (...args: Parameters<typeof env.locks.request>) => {
        tab.current?.controller.dispose();
        return env.locks.request(...args);
      },
      query: () => env.locks.query(),
    };
    tab.current = openTab(env, { name: 'a', locks });
    void tab.current.controller.open();
    await settle(20);

    expect(tab.current.snapshot().role).toBeNull();
    expect(env.locks.isHeld(fileLockName(SUB, 'file-1'))).toBe(false);
    expect(env.downloads()).toHaveLength(0);
  });

  it('does no work a closed leader acked', async () => {
    const a = await open('a');
    const raw = openFileChannel(
      env.hub.create,
      fileChannelName(SUB, 'file-1'),
      () => null
    );
    a.addTable('orders');
    const requests = env.drive.calls.length;

    raw.post({ type: 'save-request' });
    await settle(0);
    expect(env.sent.at(-1)?.message.type).toBe('status');
    a.close();
    tabs.splice(tabs.indexOf(a), 1);
    a.close();
    await settle(20);

    expect(env.drive.calls).toHaveLength(requests);
  });

  it('shares one ack among a follower’s flushes', async () => {
    await open('a');
    const b = await open('b');

    const first = b.controller.flush();
    const second = b.controller.flush();
    await settle(20);

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(
      env.sent.filter(
        ({ tab, message }) => tab === 'b' && message.type === 'save-request'
      )
    ).toHaveLength(2);
    // One ack timer: a second one the ack never cleared would say the leader went.
    await settle(ACK_TIMEOUT_MS);
    expect(b.snapshot().saveState).toBe('saved');
  });

  it('waits for the page to hide and for a token before it saves', async () => {
    const page = new EventTarget() as EventTarget & {
      visibilityState: DocumentVisibilityState;
    };
    page.visibilityState = 'visible';
    const listeners = new Set<() => void>();
    const tokenSnapshot = { status: 'fallback-expired' };
    const tokens = {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot: () => tokenSnapshot,
    } as unknown as TabOptions['tokens'];
    const a = await open('a', { document: page, tokens });
    const b = await open('b', { document: page });

    b.addTable('orders');
    page.dispatchEvent(new Event('visibilitychange'));
    listeners.forEach(listener => listener());
    await settle(5);
    expect(env.patches()).toHaveLength(0);

    page.visibilityState = 'hidden';
    page.dispatchEvent(new Event('visibilitychange'));
    await settle(5);
    expect(env.patches().map(env.tabOf)).toEqual(['a']);
  });

  it('takes nothing over in a tab that leads', async () => {
    const a = await open('a');
    const steals = env.locks.calls.length;

    await a.controller.takeOver();

    expect(env.locks.calls).toHaveLength(steals);
  });

  it('downloads the loaded document before an editor holds it, and nothing before that', async () => {
    const a = openTab(env, { name: 'a', autoAttach: false });
    tabs.push(a);
    a.controller.downloadChanges();
    expect(a.downloads).toEqual([]);

    void a.controller.open();
    await settle(20);
    a.controller.downloadChanges();

    expect(a.downloads).toEqual([
      { fileName: 'shop.erd', text: driveContent() },
    ]);
  });

  it('saves a download through the browser by default', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:changes');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      }
    );
    const controller = createDocumentController({
      fileId: 'file-1',
      sub: SUB,
      drive: env.clientFor('a'),
      locks: env.locks,
      createChannel: env.hub.create,
    });
    void controller.open();
    await settle(20);

    controller.downloadChanges();
    controller.dispose();

    expect(clicked).toEqual(['shop.erd']);
    const [blob] = createObjectURL.mock.calls[0] as [Blob];
    expect(await blob.text()).toBe(driveContent());
  });
});
