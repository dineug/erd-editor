import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createPeerEditor,
  documentWith,
  type PeerEditor,
  settle,
  tableNames,
  USERS_DOCUMENT,
} from '@/__test-utils__/driveDocument';
import {
  createChannelHub,
  createFakeDrive,
  createFakeGis,
  createFakePopup,
  createFakeRelay,
  createLockManager,
  htmlReply,
  receiverChecked,
} from '@/__test-utils__/gdrive';
import { AUTH_CHANNEL } from '@/server/auth/contract';
import { RELAY_LOGOUT_PATH } from '@/services/gdrive/authMode';
import {
  createDriveClient,
  DRIVE_API,
  DRIVE_UPLOAD_API,
} from '@/services/gdrive/driveClient';
import { FILES_CHANNEL_PREFIX } from '@/services/gdrive/fileChannel';
import {
  createGdriveSession,
  type GdriveSession,
  MESSAGES,
  type SessionLocation,
} from '@/services/gdrive/session';
import {
  ADOPT_WAIT_MS,
  createTokenManager,
} from '@/services/gdrive/tokenManager';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const EMPTY_DOCUMENT = documentWith();

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

/** One browser: its channels, locks, storage, the relay with userinfo, and Drive. */
function createBrowser() {
  const hub = createChannelHub();
  const locks = createLockManager();
  const relay = createFakeRelay();
  const drive = createFakeDrive();
  const relayFetch = relay.fetch;
  const driveFetch = drive.fetch;
  // Every access token the relay hands out opens this Drive.
  for (let n = 1; n <= 100; n++) drive.tokens.add(`access-${n}`);
  return {
    hub,
    locks,
    relay,
    drive,
    storage: memoryStorage(),
    online: true,
    fetch: receiverChecked((url, init) =>
      url.startsWith(DRIVE_API) || url.startsWith(DRIVE_UPLOAD_API)
        ? driveFetch(url, init)
        : relayFetch(url, init)
    ),
  };
}

type Browser = ReturnType<typeof createBrowser>;

function openTab(browser: Browser, initial?: SessionLocation) {
  const events = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  const gis = createFakeGis();
  const popup = createFakePopup();
  const opened: string[] = [];
  const tokens = createTokenManager({
    fetch: browser.fetch,
    clientId: CLIENT_ID,
    createChannel: browser.hub.create,
    locks: browser.locks,
    storage: browser.storage,
    loadGis: gis.load,
    openWindow: url => {
      opened.push(url);
      return popup.window;
    },
    events,
    document: doc,
    isOnline: () => browser.online,
  });
  const drive = createDriveClient({
    fetch: browser.fetch,
    getAccessToken: () => tokens.getAccessToken(),
    onUnauthorized: stale => tokens.onUnauthorized(stale),
    onInsufficientScope: () => tokens.reportInsufficientScope(),
  });
  const navigations: Array<{ fileId: string | null; replace: boolean }> = [];
  const downloads: Array<{ fileName: string; text: string }> = [];
  const editors: PeerEditor[] = [];

  const session: GdriveSession = createGdriveSession({
    tokens,
    drive,
    locks: browser.locks,
    createChannel: browser.hub.create,
    navigate: (fileId, { replace }) => {
      navigations.push({ fileId, replace });
      // The router renders a task later, with the file alone in the query.
      setTimeout(() => session.setLocation({ state: null, file: fileId }), 0);
    },
    events,
    document: doc,
    createContent: () => EMPTY_DOCUMENT,
    convert: async () => USERS_DOCUMENT,
    download: (fileName, text) => downloads.push({ fileName, text }),
    retry: { sleep: async () => {}, random: () => 0 },
  });

  // Mounts an editor for every document load while the workspace shows, as
  // GdriveEditor does, and unmounts it when an account screen takes its place.
  let mounted: { key: string; detach: () => void } | null = null;
  const mount = () => {
    const { screen, controller, document } = session.getSnapshot();
    const key =
      screen === 'workspace' && controller && document?.phase === 'ready'
        ? `${controller.fileId}/${document.epoch}`
        : null;
    if (key === (mounted?.key ?? null)) return;
    mounted?.detach();
    mounted = null;
    if (key === null) return;
    const editor = createPeerEditor(`editor-${editors.length}`);
    editors.push(editor);
    mounted = { key, detach: controller!.attach(editor.adapter) };
  };
  session.subscribe(() => queueMicrotask(mount));
  if (initial) session.setLocation(initial);

  return {
    session,
    tokens,
    gis,
    popup,
    opened,
    events,
    navigations,
    downloads,
    editors,
    snapshot: () => session.getSnapshot(),
    get editor(): PeerEditor {
      return editors.at(-1)!;
    },
  };
}

type Tab = ReturnType<typeof openTab>;

async function start(tab: Tab) {
  const started = tab.session.start();
  await settle(ADOPT_WAIT_MS);
  await started;
  await settle(10);
}

/** The callback page telling this tab's popup how its sign-in went. */
async function finishPopup(browser: Browser, tab: Tab, ok = true) {
  const url = new URL(tab.opened.at(-1)!, 'https://erd-editor.io');
  browser.hub.broadcast(AUTH_CHANNEL, {
    type: 'oauth-done',
    attempt: url.searchParams.get('attempt'),
    ok,
    error: ok ? null : 'access_denied',
  });
  await settle(10);
}

function openState(fileId: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ action: 'open', ids: [fileId], ...extra });
}

function patches(browser: Browser, fileId: string) {
  return browser.drive
    .callsTo('PATCH')
    .filter(call => call.url.pathname === `/upload/drive/v3/files/${fileId}`);
}

let browser: Browser;

beforeEach(() => {
  vi.useFakeTimers();
  browser = createBrowser();
  browser.drive.add({
    id: 'file-1',
    name: 'shop.erd.json',
    content: USERS_DOCUMENT,
  });
  browser.drive.add({
    id: 'file-2',
    name: 'blog.erd',
    content: USERS_DOCUMENT,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('signing in', () => {
  it('checks before it knows, then asks to sign in and keeps the state from Drive', async () => {
    browser.relay.signedIn = false;
    const tab = openTab(browser, { state: openState('file-1'), file: null });
    expect(tab.snapshot().screen).toBe('checking');

    await start(tab);

    expect(tab.snapshot().screen).toBe('sign-in');
    expect(tab.navigations).toEqual([]);
    expect(tab.snapshot().files).toEqual([]);
  });

  it('signs in through the relay popup, lists the files and opens the one Drive sent', async () => {
    browser.relay.signedIn = false;
    browser.drive.add({
      id: 'keyed',
      name: 'keyed.vuerd',
      content: USERS_DOCUMENT,
      resourceKey: 'key-1',
    });
    const tab = openTab(browser, {
      state: openState('keyed', {
        userId: 'sub-1',
        resourceKeys: { keyed: 'key-1' },
      }),
      file: null,
    });
    await start(tab);

    tab.session.signIn();
    expect(tab.opened).toHaveLength(1);
    expect(tab.opened[0]).toMatch(/^\/api\/auth\/start\?attempt=/);
    expect(tab.snapshot().token.signingIn).toBe(true);
    browser.relay.signedIn = true;
    await finishPopup(browser, tab);
    await settle(10);

    const snapshot = tab.snapshot();
    expect(snapshot.screen).toBe('workspace');
    expect(snapshot.token.account).toEqual({
      sub: 'sub-1',
      email: 'person@example.com',
    });
    expect(tab.navigations).toEqual([{ fileId: 'keyed', replace: true }]);
    expect(snapshot.document?.phase).toBe('ready');
    expect(snapshot.document?.name).toBe('keyed.vuerd');
    expect(snapshot.filesState).toBe('ready');
    expect(snapshot.files.map(file => file.id).sort()).toEqual([
      'file-1',
      'file-2',
      'keyed',
    ]);
    const download = browser.drive
      .callsTo('GET')
      .find(call => call.url.searchParams.get('alt') === 'media');
    expect(download?.headers.get('X-Goog-Drive-Resource-Keys')).toBe(
      'keyed/key-1'
    );
  });

  it('cancels the popup it waits for', async () => {
    browser.relay.signedIn = false;
    const tab = openTab(browser);
    await start(tab);

    tab.session.signIn();
    tab.session.cancelSignIn();
    await settle(10);

    expect(tab.snapshot().token.signingIn).toBe(false);
    expect(tab.snapshot().screen).toBe('sign-in');
  });

  it('continues with the token client once the relay failed its contract', async () => {
    browser.relay.queue(htmlReply(200));
    const tab = openTab(browser);
    await start(tab);

    expect(tab.snapshot().screen).toBe('sign-in');
    expect(tab.snapshot().token.mode).toBe('fallback');
    const tokenCalls = browser.relay.tokenCalls();

    tab.session.signIn();
    expect(tab.gis.requests).toEqual([{ prompt: 'select_account' }]);
    tab.gis.respond({
      access_token: browser.relay.issue(),
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/drive.file openid email',
    });
    await settle(10);

    expect(tab.snapshot().screen).toBe('workspace');
    expect(tab.snapshot().token.status).toBe('fallback');
    expect(tab.snapshot().files).toHaveLength(2);
    expect(browser.relay.tokenCalls()).toBe(tokenCalls);
    expect(tab.opened).toEqual([]);
  });

  it('reconnects through the relay popup outside the fallback', async () => {
    const tab = openTab(browser);
    await start(tab);

    tab.session.reconnect();

    expect(tab.opened).toHaveLength(1);
    expect(tab.opened[0]).toContain('login_hint=sub-1');
  });

  it('shows offline without deciding anything', async () => {
    browser.online = false;
    browser.relay.queue('network-error');
    const tab = openTab(browser);
    await start(tab);

    expect(tab.snapshot().screen).toBe('offline');
  });

  it('shows a missing Drive grant', async () => {
    browser.relay.scope = 'openid email';
    const tab = openTab(browser);
    await start(tab);

    expect(tab.snapshot().screen).toBe('scope-missing');
  });

  it('starts once', async () => {
    const tab = openTab(browser);
    await start(tab);
    const calls = browser.relay.tokenCalls();

    await tab.session.start();

    expect(browser.relay.tokenCalls()).toBe(calls);
  });
});

describe("Drive's state", () => {
  it('asks for the account the state names, and switching signs in with it as the hint', async () => {
    const tab = openTab(browser, {
      state: openState('file-1', { userId: 'sub-2' }),
      file: null,
    });
    await start(tab);

    expect(tab.snapshot().screen).toBe('account-mismatch');
    expect(tab.navigations).toEqual([]);

    tab.session.switchAccount();
    expect(tab.opened.at(-1)).toContain('login_hint=sub-2');
    browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
    await finishPopup(browser, tab);
    await settle(10);

    expect(tab.snapshot().screen).toBe('workspace');
    expect(tab.snapshot().token.account?.email).toBe('other@example.com');
    expect(tab.navigations).toEqual([{ fileId: 'file-1', replace: true }]);
    expect(tab.snapshot().document?.phase).toBe('ready');
  });

  it("leaves a state for another account for this account's files", async () => {
    const state = openState('file-1', { userId: 'sub-2' });
    const tab = openTab(browser, { state, file: null });
    await start(tab);
    expect(tab.snapshot().screen).toBe('account-mismatch');

    tab.session.dismissState();
    await settle(10);

    expect(tab.navigations).toEqual([{ fileId: null, replace: true }]);
    expect(tab.snapshot()).toMatchObject({
      screen: 'workspace',
      document: null,
      filesState: 'ready',
    });
    expect(tab.snapshot().token.account?.sub).toBe('sub-1');

    // A render that still carries the state acts on it no more.
    tab.session.setLocation({ state, file: null });
    expect(tab.snapshot().screen).toBe('workspace');
    tab.session.dismissState();
    expect(tab.navigations).toHaveLength(1);
  });

  it('drops a state it cannot read, with a notice', async () => {
    const tab = openTab(browser, {
      state: '{"action":"nope"}',
      file: 'file-2',
    });
    await start(tab);
    await settle(10);

    expect(tab.snapshot().notice?.message).toBe(MESSAGES.unreadableState);
    expect(tab.snapshot().notice?.tone).toBe('warning');
    expect(tab.navigations).toEqual([{ fileId: 'file-2', replace: true }]);
    expect(tab.snapshot().document?.phase).toBe('ready');

    tab.session.dismissNotice();
    expect(tab.snapshot().notice).toBeNull();
  });

  it('acts on a state once while the route still carries it', async () => {
    const state = openState('file-1');
    const tab = openTab(browser, { state, file: null });
    await start(tab);
    tab.session.setLocation({ state, file: 'other' });
    tab.session.setLocation({ state, file: null });

    expect(tab.navigations).toEqual([{ fileId: 'file-1', replace: true }]);
  });

  it('names the folder of a create state, creates there and replaces the URL', async () => {
    browser.drive.add({
      id: 'folder-1',
      name: 'Projects',
      mimeType: FOLDER_MIME,
      resourceKey: 'folder-key',
    });
    const state = JSON.stringify({
      action: 'create',
      folderId: 'folder-1',
      folderResourceKey: 'folder-key',
      userId: 'sub-1',
    });
    const tab = openTab(browser, { state, file: null });
    await start(tab);

    expect(tab.snapshot().create).toMatchObject({
      folderId: 'folder-1',
      folderName: 'Projects',
      status: 'idle',
    });

    await tab.session.confirmCreate('orders.erd');
    await settle(10);

    const post = browser.drive.callsTo('POST')[0];
    expect(post.body).toContain('"name":"orders.erd.json"');
    expect(post.body).toContain('"parents":["folder-1"]');
    const created = tab.navigations.at(-1)!;
    expect(created).toEqual({ fileId: 'created-1', replace: true });
    expect(tab.snapshot().create).toBeNull();
    expect(tab.snapshot().document?.phase).toBe('ready');
    expect(tab.snapshot().document?.name).toBe('orders.erd.json');
    expect(tab.snapshot().files.some(file => file.id === 'created-1')).toBe(
      true
    );
    // The route may still render the state once: nothing is created twice.
    tab.session.setLocation({ state, file: null });
    await settle(10);
    expect(browser.drive.callsTo('POST')).toHaveLength(1);
  });

  it('says it cannot see a folder, and offers My Drive when Drive refuses it', async () => {
    const tab = openTab(browser, {
      state: JSON.stringify({ action: 'create', folderId: 'hidden' }),
      file: null,
    });
    await start(tab);

    expect(tab.snapshot().create?.folderName).toBeNull();

    browser.drive.failNext('POST', 404, 'notFound');
    await tab.session.confirmCreate('orders');
    expect(tab.snapshot().create?.status).toBe('folder-refused');

    await tab.session.confirmCreate('orders', true);
    await settle(10);

    expect(browser.drive.callsTo('POST').at(-1)?.body).not.toContain('parents');
    expect(tab.navigations.at(-1)).toEqual({
      fileId: 'created-1',
      replace: true,
    });
  });

  it('creates in My Drive for a state without a folder, and reports a failure', async () => {
    const tab = openTab(browser, {
      state: JSON.stringify({ action: 'create' }),
      file: null,
    });
    await start(tab);

    expect(tab.snapshot().create).toMatchObject({
      folderId: null,
      folderName: null,
    });

    browser.drive.failNext('POST', 500);
    await tab.session.confirmCreate('orders');
    expect(tab.snapshot().create?.status).toBe('failed');
  });

  it('cancels a create back to the list, the state dropped', async () => {
    const tab = openTab(browser, {
      state: JSON.stringify({ action: 'create' }),
      file: null,
    });
    await start(tab);

    tab.session.cancelCreate();
    await settle(10);

    expect(tab.snapshot().create).toBeNull();
    expect(tab.navigations).toEqual([{ fileId: null, replace: true }]);
    expect(browser.drive.callsTo('POST')).toEqual([]);
    tab.session.cancelCreate();
    await tab.session.confirmCreate('late');
    expect(browser.drive.callsTo('POST')).toEqual([]);
  });

  it('drops the create dialog when the route leaves the state', async () => {
    const tab = openTab(browser, {
      state: JSON.stringify({ action: 'create' }),
      file: null,
    });
    await start(tab);

    tab.session.setLocation({ state: null, file: null });

    expect(tab.snapshot().create).toBeNull();
  });
});

describe('the open file', () => {
  it('saves before a switch, and a save that fails asks first', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    tab.editor.addTable('orders');

    tab.session.setLocation({ state: null, file: 'file-2' });
    expect(tab.snapshot().busy).toBe(true);
    await settle(10);

    expect(patches(browser, 'file-1')).toHaveLength(1);
    expect(tab.snapshot().busy).toBe(false);
    expect(tab.snapshot().controller?.fileId).toBe('file-2');

    tab.editor.addTable('posts');
    browser.drive.failNext('PATCH', 400, 'badRequest');
    tab.session.setLocation({ state: null, file: 'file-1' });
    await settle(10);

    expect(tab.snapshot().leave).toEqual({
      reason: 'switch',
      target: 'file-1',
    });
    expect(tab.snapshot().controller?.fileId).toBe('file-2');
    // The person decides; nothing else starts the save again meanwhile.
    tab.session.setLocation({ state: null, file: 'file-1' });
    await settle(10);
    expect(patches(browser, 'file-2')).toHaveLength(1);

    tab.session.stay();
    await settle(10);
    expect(tab.navigations.at(-1)).toEqual({ fileId: 'file-2', replace: true });
    expect(tab.snapshot().leave).toBeNull();
    expect(tab.snapshot().controller?.fileId).toBe('file-2');

    browser.drive.failNext('PATCH', 400, 'badRequest');
    tab.session.setLocation({ state: null, file: null });
    await settle(10);
    expect(tab.snapshot().leave).toEqual({ reason: 'switch', target: null });

    await tab.session.leaveAnyway();
    expect(tab.snapshot().controller).toBeNull();
    expect(tab.snapshot().leave).toBeNull();
  });

  it('leaves anyway to the file it was going to', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    tab.editor.addTable('orders');
    browser.drive.failNext('PATCH', 400, 'badRequest');

    tab.session.setLocation({ state: null, file: 'file-2' });
    await settle(10);
    await tab.session.leaveAnyway();
    await settle(10);

    expect(tab.snapshot().controller?.fileId).toBe('file-2');
    expect(tab.snapshot().document?.phase).toBe('ready');
    // Nothing waits any more.
    await tab.session.leaveAnyway();
    tab.session.stay();
    expect(tab.snapshot().controller?.fileId).toBe('file-2');
  });

  it('drops a waiting leave when the route comes back to the open file', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    tab.editor.addTable('orders');
    browser.drive.failNext('PATCH', 400, 'badRequest');

    tab.session.setLocation({ state: null, file: 'file-2' });
    await settle(10);
    expect(tab.snapshot().leave).toEqual({
      reason: 'switch',
      target: 'file-2',
    });

    // Back to the file still open, as the browser's Back button does.
    tab.session.setLocation({ state: null, file: 'file-1' });
    await settle(10);
    expect(tab.snapshot().leave).toBeNull();

    await tab.session.leaveAnyway();
    await settle(10);
    expect(tab.snapshot().controller?.fileId).toBe('file-1');
  });

  it('calls off a switch still saving when the route comes back', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    tab.editor.addTable('orders');
    const release = browser.drive.hold('PATCH');

    tab.session.setLocation({ state: null, file: 'file-2' });
    await settle(10);
    expect(tab.snapshot().busy).toBe(true);
    tab.session.setLocation({ state: null, file: 'file-1' });
    expect(tab.snapshot().busy).toBe(false);
    release();
    await settle(10);

    expect(tab.snapshot().controller?.fileId).toBe('file-1');
  });

  it('passes the banners and the status on to the file', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    const { controller } = tab.snapshot();

    tab.editor.addTable('orders');
    expect(tab.session.hasUnsavedChanges()).toBe(true);
    expect(await tab.session.retrySave()).toBe(true);
    expect(tab.session.hasUnsavedChanges()).toBe(false);

    tab.session.downloadChanges();
    expect(tab.downloads.map(entry => entry.fileName)).toEqual(['shop.erd']);
    expect(await tab.session.checkDrive()).toBe('skipped');
    await tab.session.takeOver();
    expect(await tab.session.reload()).toBe(true);
    await settle(10);
    expect(tab.snapshot().controller).toBe(controller);

    tab.session.reopen();
    await settle(10);
    expect(tab.snapshot().controller).not.toBe(controller);
    expect(tab.snapshot().document?.phase).toBe('ready');
  });

  it('says so when Check Drive cannot reach Drive, and resumes once it can', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    browser.drive.loseNextResponse('PATCH');
    tab.editor.addTable('orders');
    await settle(2010);
    expect(tab.snapshot().document?.saveState).toBe('unconfirmed');

    browser.drive.failNext('GET', 500);
    expect(await tab.session.checkDrive()).toBe('failed');
    expect(tab.snapshot().notice?.message).toBe(MESSAGES.checkFailed);
    expect(tab.snapshot().document?.saveState).toBe('unconfirmed');

    expect(await tab.session.checkDrive()).toBe('resumed');
    expect(tab.snapshot().document?.saveState).toBe('saved');
  });

  it('tells a follower tab when its Check Drive could not reach Drive', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    const other = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await start(other);
    await settle(10);
    browser.drive.loseNextResponse('PATCH');
    other.editor.addTable('orders');
    await settle(3010);
    expect(other.snapshot().document).toMatchObject({
      role: 'follower',
      saveState: 'unconfirmed',
    });

    browser.drive.failNext('GET', 500);
    const checking = other.session.checkDrive();
    await settle(20);

    expect(await checking).toBe('failed');
    expect(other.snapshot().notice?.message).toBe(MESSAGES.checkFailed);
    expect(tab.snapshot().notice).toBeNull();
  });

  it('keeps edits to download once Drive takes edit access away', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    browser.drive.files.get('file-1')!.canEdit = false;

    tab.editor.addTable('orders');
    await settle(2010);

    expect(tab.snapshot().document).toMatchObject({
      saveState: 'readonly',
      canEdit: false,
      accessLost: true,
    });
    expect(tab.session.hasUnsavedChanges()).toBe(true);
    tab.session.downloadChanges();
    expect(tableNames(tab.downloads[0].text)).toEqual(['orders', 'users']);
    expect(patches(browser, 'file-1')).toHaveLength(0);
  });

  it('does nothing for the file actions without a file', async () => {
    const tab = openTab(browser);
    await start(tab);

    expect(tab.session.hasUnsavedChanges()).toBe(false);
    expect(await tab.session.retrySave()).toBe(true);
    expect(await tab.session.reload()).toBe(false);
    expect(await tab.session.checkDrive()).toBeNull();
    await tab.session.takeOver();
    tab.session.downloadChanges();
    tab.session.reopen();
    expect(tab.snapshot().controller).toBeNull();
  });

  it('closes a file without edits when another tab signs out, and opens it again after', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    const other = openTab(browser);
    await start(tab);
    await start(other);
    await settle(10);
    const { controller } = tab.snapshot();

    await other.session.signOut();
    await settle(10);
    expect(tab.snapshot()).toMatchObject({
      screen: 'sign-in',
      controller: null,
      keptChanges: false,
      files: [],
    });
    expect(tab.session.hasUnsavedChanges()).toBe(false);

    tab.session.signIn();
    browser.relay.signedIn = true;
    await finishPopup(browser, tab);
    await settle(10);
    expect(tab.snapshot().screen).toBe('workspace');
    expect(tab.snapshot().controller?.fileId).toBe('file-1');
    expect(tab.snapshot().controller).not.toBe(controller);
    expect(tab.snapshot().document?.phase).toBe('ready');
  });

  it('keeps the file through a 401 for the same account, with nothing to download', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    const { controller } = tab.snapshot();
    browser.relay.signedIn = false;
    browser.drive.tokens.clear();

    tab.events.dispatchEvent(new Event('focus'));
    await settle(ADOPT_WAIT_MS + 10);

    expect(tab.snapshot()).toMatchObject({
      screen: 'sign-in',
      controller,
      keptChanges: false,
    });
    expect(tab.snapshot().token.bySignOut).toBe(false);
  });

  it('keeps counting the edits an account screen took the editor from, and saves them back', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    const other = openTab(browser);
    await start(tab);
    await start(other);
    await settle(10);
    tab.editor.addTable('orders');

    await other.session.signOut();
    await settle(10);
    expect(tab.snapshot().screen).toBe('sign-in');
    expect(tab.snapshot().keptChanges).toBe(true);
    expect(tab.session.hasUnsavedChanges()).toBe(true);
    tab.session.downloadChanges();
    expect(tableNames(tab.downloads[0].text)).toEqual(['orders', 'users']);

    // The save it had coming waits for a token instead of passing for saved.
    await settle(2000);
    expect(tab.snapshot().document?.saveState).toBe('paused');
    expect(patches(browser, 'file-1')).toHaveLength(0);

    tab.session.signIn();
    browser.relay.signedIn = true;
    await finishPopup(browser, tab);
    await settle(10);
    expect(tab.snapshot().screen).toBe('workspace');
    expect(tableNames(tab.editor.store.value)).toEqual(['orders', 'users']);
    expect(patches(browser, 'file-1')).toHaveLength(1);
    expect(tab.session.hasUnsavedChanges()).toBe(false);
  });
});

describe('another account', () => {
  it('holds the edits it found unsaved until the person downloads them or goes on', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    const other = openTab(browser);
    await start(tab);
    await start(other);
    await settle(10);
    tab.editor.addTable('orders');
    await other.session.signOut();
    await settle(10);

    // Another tab signs in with a second account; this one was left alone.
    browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
    browser.relay.signedIn = true;
    other.session.signIn();
    await finishPopup(browser, other);
    await settle(10);

    expect(tab.snapshot()).toMatchObject({
      screen: 'unsaved-changes',
      stranded: { name: 'shop.erd.json', email: 'person@example.com' },
      keptChanges: true,
    });
    expect(tab.snapshot().token.account?.sub).toBe('sub-2');
    expect(tab.session.hasUnsavedChanges()).toBe(true);
    await settle(10_000);
    expect(patches(browser, 'file-1')).toHaveLength(0);

    tab.session.downloadChanges();
    expect(tableNames(tab.downloads[0].text)).toEqual(['orders', 'users']);
    tab.session.discardChanges();
    tab.session.discardChanges();
    await settle(10);

    expect(tab.snapshot()).toMatchObject({
      screen: 'workspace',
      stranded: null,
      keptChanges: false,
    });
    expect(tab.session.hasUnsavedChanges()).toBe(false);
    expect(tab.snapshot().document?.phase).toBe('ready');
    expect(tableNames(tab.editor.store.value)).toEqual(['users']);
  });

  it('lists the new account’s files when it signs in while the old one’s list is out', async () => {
    const tab = openTab(browser, {
      state: openState('file-1', { userId: 'sub-2' }),
      file: null,
    });
    await start(tab);
    expect(tab.snapshot().filesState).toBe('ready');
    const isList = (url: URL) => url.pathname === '/drive/v3/files';
    const release = browser.drive.hold('GET', isList);
    tab.events.dispatchEvent(new Event('focus'));
    await settle(10);
    const lists = browser.drive.callsTo('GET').filter(call => isList(call.url));

    tab.session.switchAccount();
    browser.relay.account = { sub: 'sub-2', email: 'other@example.com' };
    await finishPopup(browser, tab);
    await settle(10);

    expect(
      browser.drive.callsTo('GET').filter(call => isList(call.url)).length
    ).toBeGreaterThan(lists.length);
    expect(tab.snapshot().filesState).toBe('ready');
    expect(tab.snapshot().files).toHaveLength(2);
    release();
    await settle(10);
    expect(tab.snapshot().filesState).toBe('ready');
    expect(tab.snapshot().files).toHaveLength(2);
    expect(tab.snapshot().token.account?.sub).toBe('sub-2');
  });
});

describe('the list', () => {
  it('opens a file in a new history entry, and the open one in none', async () => {
    const tab = openTab(browser);
    await start(tab);

    tab.session.openFile('file-2');
    await settle(10);
    tab.session.openFile('file-2');

    expect(tab.navigations).toEqual([{ fileId: 'file-2', replace: false }]);
    expect(tab.snapshot().controller?.fileId).toBe('file-2');
  });

  it('lists every page and refreshes when the window gets focus', async () => {
    const tab = openTab(browser);
    await start(tab);

    expect(
      tab
        .snapshot()
        .files.map(file => file.name)
        .sort()
    ).toEqual(['blog.erd', 'shop.erd.json']);
    browser.drive.add({ id: 'file-3', name: 'new.erd', content: '{}' });
    tab.events.dispatchEvent(new Event('focus'));
    await settle(10);

    expect(tab.snapshot().files).toHaveLength(3);
  });

  it('says so when the first list fails, and keeps a list it had', async () => {
    browser.drive.failNext('GET', 400, 'badRequest');
    const tab = openTab(browser);
    await start(tab);
    expect(tab.snapshot().filesState).toBe('failed');

    await tab.session.refreshFiles();
    expect(tab.snapshot().filesState).toBe('ready');

    browser.drive.failNext('GET', 400, 'badRequest');
    await tab.session.refreshFiles();
    expect(tab.snapshot().filesState).toBe('ready');
    expect(tab.snapshot().files).toHaveLength(2);
  });

  it('follows the files another tab created or renamed', async () => {
    const tab = openTab(browser);
    await start(tab);
    const channel = browser.hub.create(`${FILES_CHANNEL_PREFIX}/sub-1`);
    const file = {
      id: 'file-9',
      name: 'elsewhere.erd.json',
      mimeType: 'application/json',
      modifiedTime: '2026-09-25T10:00:00.000Z',
      size: 2,
      trashed: false,
      parents: ['root'],
      canEdit: true,
      canRename: true,
    };

    channel.postMessage({ type: 'created', file });
    channel.postMessage({ type: 'created', file });
    channel.postMessage({
      type: 'renamed',
      fileId: 'file-1',
      name: 'market.erd.json',
      modifiedTime: '2026-09-25T11:00:00.000Z',
    });
    await settle(10);

    const names = tab.snapshot().files.map(entry => entry.name);
    expect(names.filter(name => name === 'elsewhere.erd.json')).toHaveLength(1);
    expect(names).toContain('market.erd.json');
  });

  it('moves the open file up the list with every save, in every tab of the account', async () => {
    const tab = openTab(browser, { state: null, file: 'file-2' });
    const other = openTab(browser);
    await start(tab);
    await start(other);
    await settle(10);
    const listed = (of: Tab, fileId: string) =>
      of.snapshot().files.find(file => file.id === fileId)?.modifiedTime;
    const before = listed(tab, 'file-2')!;

    tab.editor.addTable('orders');
    await settle(2000);
    await settle(10);

    const saved = browser.drive.files.get('file-2')!.modifiedTime;
    expect(Date.parse(saved)).toBeGreaterThan(Date.parse(before));
    expect(tab.snapshot().document?.modifiedTime).toBe(saved);
    expect(listed(tab, 'file-2')).toBe(saved);
    expect(listed(other, 'file-2')).toBe(saved);
    expect(tab.snapshot().files[0].id).toBe('file-2');

    // News of an older save moves no entry back.
    browser.hub.create(`${FILES_CHANNEL_PREFIX}/sub-1`).postMessage({
      type: 'saved',
      fileId: 'file-2',
      modifiedTime: before,
    });
    await settle(10);
    expect(listed(other, 'file-2')).toBe(saved);
  });

  it('renames the open file through its leader and keeps its extension', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    const other = openTab(browser);
    await start(tab);
    await start(other);
    await settle(10);

    await tab.session.renameFile('file-1', 'market');
    await settle(10);

    expect(browser.drive.files.get('file-1')?.name).toBe('market.erd.json');
    expect(tab.snapshot().document?.name).toBe('market.erd.json');
    expect(tab.snapshot().files.find(file => file.id === 'file-1')?.name).toBe(
      'market.erd.json'
    );
    expect(
      other.snapshot().files.find(file => file.id === 'file-1')?.name
    ).toBe('market.erd.json');
  });

  it('keeps what it created or renamed while a list was on its way', async () => {
    const tab = openTab(browser);
    await start(tab);
    const release = browser.drive.holdAnswer(
      'GET',
      url => url.pathname === '/drive/v3/files'
    );
    tab.events.dispatchEvent(new Event('focus'));
    await settle(10);

    await tab.session.newFile('orders');
    await tab.session.renameFile('file-2', 'journal');
    // News older than the list's answer loses to it.
    browser.hub.create(`${FILES_CHANNEL_PREFIX}/sub-1`).postMessage({
      type: 'renamed',
      fileId: 'file-1',
      name: 'stale.erd.json',
      modifiedTime: '2000-01-01T00:00:00.000Z',
    });
    await settle(10);
    expect(tab.snapshot().files.map(file => file.name)).toContain(
      'stale.erd.json'
    );
    release();
    await settle(10);

    expect(
      tab
        .snapshot()
        .files.map(file => file.name)
        .sort()
    ).toEqual(['journal.erd', 'orders.erd.json', 'shop.erd.json']);
  });

  it('renames a file no tab has open at Drive', async () => {
    const tab = openTab(browser);
    await start(tab);

    await tab.session.renameFile('file-2', 'journal.erd.json');

    expect(browser.drive.files.get('file-2')?.name).toBe('journal.erd');
    expect(tab.snapshot().files.find(file => file.id === 'file-2')?.name).toBe(
      'journal.erd'
    );
  });

  it('skips a rename that changes nothing and reports one Drive refuses', async () => {
    const tab = openTab(browser);
    await start(tab);
    const patchCount = browser.drive.callsTo('PATCH').length;

    await tab.session.renameFile('file-2', 'blog');
    await tab.session.renameFile('file-2', '  ');
    await tab.session.renameFile('missing', 'x');
    expect(browser.drive.callsTo('PATCH')).toHaveLength(patchCount);

    browser.drive.failNext('PATCH', 403, 'insufficientFilePermissions');
    await tab.session.renameFile('file-2', 'journal');
    expect(tab.snapshot().notice?.message).toBe(MESSAGES.renameFailed);
  });

  it('creates a new file in My Drive and opens it', async () => {
    const tab = openTab(browser);
    await start(tab);

    await tab.session.newFile('orders');
    await settle(10);

    const post = browser.drive.callsTo('POST')[0];
    expect(post.body).toContain('"name":"orders.erd.json"');
    expect(post.body).not.toContain('parents');
    expect(post.body).toContain(EMPTY_DOCUMENT);
    expect(tab.navigations).toEqual([{ fileId: 'created-1', replace: false }]);
    expect(tab.snapshot().document?.phase).toBe('ready');

    browser.drive.failNext('POST', 500);
    await tab.session.newFile('again');
    expect(tab.snapshot().notice?.message).toBe(MESSAGES.createFailed);
  });

  it('imports documents as new files, refuses a backup, and opens the last', async () => {
    const tab = openTab(browser);
    await start(tab);
    const backup = JSON.stringify({
      format: 'erd-editor-app-backup',
      version: 1,
      exportedAt: 0,
      schemas: [],
    });

    const importing = tab.session.importFiles([
      new File([USERS_DOCUMENT], 'shop.erd.json'),
      new File([backup], 'backup.json'),
      new File(['create table users (id int);'], 'blog.sql'),
    ]);
    expect(tab.snapshot().importing).toBe(true);
    await importing;
    await settle(10);

    expect(
      browser.drive
        .callsTo('POST')
        .map(call => /"name":"([^"]+)"/.exec(call.body ?? '')?.[1])
    ).toEqual(['shop.erd.json', 'blog.erd.json']);
    expect(tab.snapshot().notice).toMatchObject({
      message:
        'Imported 2 files to Google Drive · Skipped 1 backup: backups stay in the local app',
      tone: 'warning',
    });
    expect(tab.navigations).toEqual([{ fileId: 'created-2', replace: false }]);
    expect(tab.snapshot().importing).toBe(false);

    await tab.session.importFiles([new File([USERS_DOCUMENT], 'one.erd')]);
    expect(tab.snapshot().notice?.tone).toBe('success');
    await tab.session.importFiles([]);
  });

  it('opens nothing after an import the person moved on from', async () => {
    const tab = openTab(browser);
    await start(tab);
    const release = browser.drive.hold('POST');

    const importing = tab.session.importFiles([
      new File([USERS_DOCUMENT], 'shop.erd'),
    ]);
    tab.session.setLocation({ state: null, file: 'file-2' });
    release();
    await importing;

    expect(tab.navigations).toEqual([]);
  });
});

describe('signing out', () => {
  it('saves first, signs out and clears the list', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    tab.editor.addTable('orders');

    await tab.session.signOut();
    await settle(10);

    expect(patches(browser, 'file-1')).toHaveLength(1);
    expect(browser.relay.count(RELAY_LOGOUT_PATH)).toBe(1);
    expect(tab.snapshot().screen).toBe('sign-in');
    expect(tab.snapshot().files).toEqual([]);
    expect(tab.snapshot().controller).toBeNull();
    expect(tab.snapshot().notice).toBeNull();
  });

  it('says when the relay did not confirm it', async () => {
    const tab = openTab(browser);
    await start(tab);
    browser.relay.queueLogout(htmlReply(500));

    await tab.session.signOut();

    expect(tab.snapshot().notice?.message).toBe(MESSAGES.signOutUnconfirmed);
  });

  it('asks before a sign-out whose save fails, and signs out anyway', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    tab.editor.addTable('orders');
    browser.drive.failNext('PATCH', 400, 'badRequest');

    await tab.session.signOut();
    expect(tab.snapshot().leave).toEqual({ reason: 'sign-out', target: null });
    expect(tab.snapshot().screen).toBe('workspace');

    tab.session.stay();
    expect(tab.snapshot().leave).toBeNull();
    expect(tab.navigations).toEqual([]);

    browser.drive.failNext('PATCH', 400, 'badRequest');
    await tab.session.signOut();
    await tab.session.leaveAnyway();
    await settle(10);
    expect(tab.snapshot().screen).toBe('sign-in');
    expect(tab.snapshot().controller).toBeNull();
  });
});

describe('dispose', () => {
  it('closes the file and the list channel and stops listening', async () => {
    const tab = openTab(browser, { state: null, file: 'file-1' });
    await start(tab);
    await settle(10);
    const listener = vi.fn();
    tab.session.subscribe(listener);

    tab.session.dispose();
    tab.session.dispose();
    tab.events.dispatchEvent(new Event('focus'));
    await settle(10);

    expect(browser.hub.openCount(`${FILES_CHANNEL_PREFIX}/sub-1`)).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribes a listener', async () => {
    const tab = openTab(browser);
    const listener = vi.fn();
    const off = tab.session.subscribe(listener);
    off();
    await start(tab);

    expect(listener).not.toHaveBeenCalled();
  });
});
