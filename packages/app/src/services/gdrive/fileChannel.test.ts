import { tableActions$ } from '@dineug/erd-editor/peer.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createDriveEnv,
  createPeerEditor,
  type DriveEnv,
  openTab,
  settle,
  SUB,
  type Tab,
  tableNames,
  type TabOptions,
  USERS_DOCUMENT,
} from '@/__test-utils__/driveDocument';
import { createChannelHub } from '@/__test-utils__/gdrive';
import type { EditorAdapter } from '@/services/gdrive/documentController';
import {
  ACK_TIMEOUT_MS,
  fileChannelName,
  type FileMessage,
  FILES_CHANNEL_PREFIX,
  FOLLOWER_SEND_WINDOW_MS,
  followerHasUnsavedChanges,
  HELLO_BACKOFF_MS,
  openFileChannel,
  openFilesChannel,
  readFileMessage,
  readFilesMessage,
  SAVE_STATES,
  sayHello,
} from '@/services/gdrive/fileChannel';
import { fileLockName } from '@/services/gdrive/fileLeader';

const FILE = {
  id: 'file-1',
  name: 'shop.erd',
  mimeType: 'application/json',
  modifiedTime: '2026-09-25T09:00:01.000Z',
  size: 12,
  trashed: false,
  parents: ['root'],
  canEdit: true,
  canRename: true,
};

describe('readFileMessage', () => {
  const valid: Array<Record<string, unknown>> = [
    { type: 'actions', epoch: 'e1', actions: [{ type: 'table.add' }] },
    { type: 'hello', epoch: null, from: 'tab-1' },
    {
      type: 'snapshot',
      epoch: 'e1',
      to: 'tab-1',
      value: '{}',
      baseModifiedTime: 't1',
      baseFingerprint: 'f1',
      name: 'shop.erd',
      canEdit: true,
      canRename: false,
      saveState: 'conflict',
      pendingAttempt: { attemptId: 'a1', fingerprint: 'f2' },
    },
    { type: 'status', epoch: 'e1', state: 'saving', at: 1 },
    { type: 'save-request', epoch: 'e1' },
    { type: 'check-request', epoch: 'e1' },
    { type: 'reload-request', epoch: 'e1' },
    { type: 'saving', epoch: 'e1', attemptId: 'a1', fingerprint: 'f1' },
    {
      type: 'saved',
      epoch: 'e1',
      attemptId: 'a1',
      modifiedTime: 't2',
      fingerprint: 'f1',
    },
    { type: 'failed', epoch: 'e1', attemptId: 'a1' },
    {
      type: 'reloaded',
      epoch: 'e2',
      value: '{}',
      modifiedTime: 't3',
      fingerprint: 'f3',
      name: 'shop.erd',
      canEdit: false,
      canRename: true,
    },
    { type: 'rename-request', epoch: null, requestId: 'r1', name: 'a.erd' },
    {
      type: 'renamed',
      epoch: 'e1',
      requestId: null,
      name: 'a.erd',
      from: 't1',
      to: 't2',
    },
    { type: 'rename-failed', epoch: 'e1', requestId: 'r1' },
    { type: 'save-request', epoch: 'e1', requestId: 'r2' },
    { type: 'flushed', epoch: null, requestId: 'r2', saved: false },
  ];

  it.each(valid)('reads $type', message => {
    expect(readFileMessage(structuredClone(message))).toEqual(message);
  });

  it('reads a snapshot with no attempt pending', () => {
    const snapshot = { ...valid[2], pendingAttempt: null };
    expect(readFileMessage(snapshot)).toEqual(snapshot);
  });

  it('drops what it does not speak', () => {
    const invalid: unknown[] = [
      null,
      'hello',
      [],
      { epoch: 'e1' },
      { type: 'nope', epoch: 'e1' },
      { type: 'toString', epoch: 'e1' },
      { type: 'actions', epoch: 'e1', actions: {} },
      { type: 'actions', actions: [] },
      { type: 'hello', from: 1 },
      { ...valid[2], epoch: null },
      { ...valid[2], saveState: 'dirty' },
      { ...valid[2], pendingAttempt: { attemptId: 'a1' } },
      { ...valid[2], canEdit: 'yes' },
      { type: 'status', epoch: 'e1', state: 'saved' },
      { type: 'saving', epoch: 'e1', attemptId: 'a1' },
      { type: 'saved', epoch: 'e1', attemptId: 'a1', fingerprint: 'f1' },
      { type: 'failed', epoch: 'e1' },
      { ...valid[10], fingerprint: 1 },
      { ...valid[10], epoch: undefined },
      { type: 'rename-request', requestId: 'r1' },
      { ...valid[12], to: null },
      { ...valid[12], requestId: 7 },
      { type: 'rename-failed' },
      { type: 'save-request', requestId: 7 },
      { type: 'flushed', requestId: 'r2' },
      { type: 'flushed', saved: true },
    ];
    for (const message of invalid) expect(readFileMessage(message)).toBeNull();
  });

  it('reads a missing epoch as null where a message needs none', () => {
    expect(readFileMessage({ type: 'save-request' })).toEqual({
      type: 'save-request',
      epoch: null,
    });
  });

  it('knows every save state the status shows', () => {
    expect(SAVE_STATES).toEqual([
      'saved',
      'saving',
      'failed',
      'conflict',
      'unconfirmed',
      'paused',
      'deleted',
      'readonly',
      'waiting-leader',
      'waiting-snapshot',
      'account-changed',
      'scope-missing',
    ]);
  });
});

describe('openFileChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stamps every message with the epoch it was posted in', async () => {
    const hub = createChannelHub();
    let epoch: string | null = 'e1';
    const channel = openFileChannel(hub.create, 'file', () => epoch);
    const other = openFileChannel(hub.create, 'file', () => null);
    const received: FileMessage[] = [];
    other.subscribe(message => received.push(message));

    channel.post({ type: 'save-request' });
    epoch = 'e2';
    channel.post({ type: 'actions', actions: [] });
    hub.broadcast('file', { type: 'bogus' });
    await settle(5);

    expect(received).toEqual([
      { type: 'save-request', epoch: 'e1' },
      { type: 'actions', epoch: 'e2', actions: [] },
    ]);
  });

  it('stops listening and posting once closed', async () => {
    const hub = createChannelHub();
    const channel = openFileChannel(hub.create, 'file', () => 'e1');
    const other = openFileChannel(hub.create, 'file', () => 'e1');
    const listener = vi.fn();
    const unsubscribed = vi.fn();
    channel.subscribe(listener);
    other.subscribe(unsubscribed)();

    channel.close();
    channel.close();
    channel.post({ type: 'save-request' });
    other.post({ type: 'save-request' });
    await settle(5);

    expect(listener).not.toHaveBeenCalled();
    expect(unsubscribed).not.toHaveBeenCalled();
    expect(hub.openCount('file')).toBe(1);
    expect(hub.posted).toHaveLength(1);
  });

  it('names the channel after the account and the file, as the lock', () => {
    expect(fileChannelName(SUB, 'file-1')).toBe(fileLockName(SUB, 'file-1'));
  });
});

describe('the files channel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tells every tab of the account of a rename and a new file', async () => {
    const hub = createChannelHub();
    const here = openFilesChannel(hub.create, SUB);
    const there = openFilesChannel(hub.create, SUB);
    const elsewhere = openFilesChannel(hub.create, 'sub-2');
    const received: unknown[] = [];
    const unrelated = vi.fn();
    there.subscribe(message => received.push(message));
    elsewhere.subscribe(unrelated);

    here.post({
      type: 'renamed',
      fileId: 'file-1',
      name: 'a.erd',
      modifiedTime: 't2',
    });
    here.post({ type: 'created', file: FILE });
    hub.broadcast(`${FILES_CHANNEL_PREFIX}/${SUB}`, { type: 'created' });
    await settle(5);

    expect(received).toEqual([
      { type: 'renamed', fileId: 'file-1', name: 'a.erd', modifiedTime: 't2' },
      { type: 'created', file: FILE },
    ]);
    expect(unrelated).not.toHaveBeenCalled();

    there.close();
    there.close();
    there.post({ type: 'created', file: FILE });
    expect(hub.openCount(`${FILES_CHANNEL_PREFIX}/${SUB}`)).toBe(1);
  });

  it('reads only a whole file and a whole rename', () => {
    expect(readFilesMessage(null)).toBeNull();
    expect(readFilesMessage({ type: 'deleted', fileId: 'f' })).toBeNull();
    expect(readFilesMessage({ type: 'renamed', fileId: 'f' })).toBeNull();
    expect(
      readFilesMessage({ type: 'created', file: { ...FILE, size: '12' } })
    ).toBeNull();
    expect(
      readFilesMessage({ type: 'created', file: { ...FILE, parents: [1] } })
    ).toBeNull();
    expect(readFilesMessage({ type: 'created', file: null })).toBeNull();
    expect(
      readFilesMessage({ type: 'created', file: { ...FILE, size: null } })
    ).toEqual({ type: 'created', file: { ...FILE, size: null } });
  });

  it('lets a listener go', async () => {
    const hub = createChannelHub();
    const here = openFilesChannel(hub.create, SUB);
    const there = openFilesChannel(hub.create, SUB);
    const listener = vi.fn();
    there.subscribe(listener)();

    here.post({ type: 'created', file: FILE });
    await settle(5);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('sayHello', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says hello at 0, 0.5, 1.5 and 3.5 seconds, and gives up at 7.5', async () => {
    const sent: number[] = [];
    const start = Date.now();
    const onGiveUp = vi.fn();

    sayHello(() => sent.push(Date.now() - start), onGiveUp);
    await settle(7499);
    expect(onGiveUp).not.toHaveBeenCalled();
    await settle(1);

    expect(HELLO_BACKOFF_MS).toEqual([500, 1000, 2000, 4000]);
    expect(sent).toEqual([0, 500, 1500, 3500]);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it('stops when told to', async () => {
    const post = vi.fn();
    const onGiveUp = vi.fn();

    const stop = sayHello(post, onGiveUp);
    await settle(600);
    stop();
    stop();
    await settle(10_000);

    expect(post).toHaveBeenCalledTimes(2);
    expect(onGiveUp).not.toHaveBeenCalled();
  });
});

describe('followerHasUnsavedChanges', () => {
  const quiet = {
    now: 10_000,
    lastChangeAt: null,
    changeUnconfirmed: false,
    state: 'saved' as const,
  };

  it('holds an edit the shared store may not have sent yet', () => {
    expect(
      followerHasUnsavedChanges({
        ...quiet,
        lastChangeAt: 10_000 - FOLLOWER_SEND_WINDOW_MS + 1,
      })
    ).toBe(true);
    expect(
      followerHasUnsavedChanges({
        ...quiet,
        lastChangeAt: 10_000 - FOLLOWER_SEND_WINDOW_MS,
      })
    ).toBe(false);
  });

  it('holds an edit no leader status has followed', () => {
    expect(
      followerHasUnsavedChanges({
        ...quiet,
        lastChangeAt: 1000,
        changeUnconfirmed: true,
      })
    ).toBe(true);
  });

  it.each([
    'saving',
    'failed',
    'paused',
    'waiting-leader',
    'conflict',
    'unconfirmed',
  ] as const)('holds while the leader is %s', state => {
    expect(followerHasUnsavedChanges({ ...quiet, state })).toBe(true);
  });

  it.each(['saved', 'readonly', 'deleted', 'waiting-snapshot'] as const)(
    'lets go while the leader is %s',
    state => {
      expect(followerHasUnsavedChanges({ ...quiet, state })).toBe(false);
    }
  );
});

describe('the file protocol, from another tab', () => {
  let env: DriveEnv;
  const tabs: Tab[] = [];
  const channelName = fileChannelName(SUB, 'file-1');

  async function open(name: string, options: Partial<TabOptions> = {}) {
    const tab = openTab(env, { name, ...options });
    tabs.push(tab);
    void tab.controller.open();
    await settle(20);
    return tab;
  }

  /** A bare tab on the file's channel, which records what it hears. */
  function rawTab(epoch: () => string | null = () => null) {
    const channel = openFileChannel(env.hub.create, channelName, epoch);
    const heard: FileMessage[] = [];
    channel.subscribe(message => heard.push(message));
    return { channel, heard, types: () => heard.map(message => message.type) };
  }

  /** A tab that holds the lock and never answers, as a frozen leader. */
  function frozenLeader() {
    env.locks
      .request(fileLockName(SUB, 'file-1'), {}, () => new Promise(() => {}))
      // A takeover steals the lock, which rejects the frozen holder's request.
      .catch(() => {});
  }

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

  it('says hello with backoff, never reads Drive while a tab holds the lock, then offers to take over', async () => {
    frozenLeader();
    const raw = rawTab();
    const hellos: number[] = [];
    const start = Date.now();
    raw.channel.subscribe(message => {
      if (message.type === 'hello') hellos.push(Date.now() - start);
    });

    const b = await open('b');
    expect(b.snapshot()).toMatchObject({ phase: 'loading', role: 'follower' });
    await settle(7500);

    expect(hellos.map(at => Math.round(at / 100) * 100)).toEqual([
      0, 500, 1500, 3500,
    ]);
    expect(b.snapshot()).toMatchObject({
      phase: 'waiting-snapshot',
      saveState: 'waiting-snapshot',
    });
    expect(env.downloads()).toHaveLength(0);

    await b.controller.takeOver();
    await settle(5);

    expect(b.snapshot()).toMatchObject({ phase: 'ready', role: 'leader' });
    expect(env.downloads().map(env.tabOf)).toEqual(['b']);
    expect(raw.types()).toContain('reloaded');
  });

  it('acks a hello at once and holds the snapshot until its editor has the document', async () => {
    const a = await open('a', { autoAttach: false });
    expect(a.snapshot()).toMatchObject({ phase: 'ready', role: 'leader' });
    const raw = rawTab();

    raw.channel.post({ type: 'hello', from: 'raw' });
    await settle(5);
    expect(raw.types()).toEqual(['status']);

    a.mount();
    await settle(5);

    const snapshot = raw.heard.find(message => message.type === 'snapshot');
    expect(snapshot).toMatchObject({
      to: 'raw',
      name: 'shop.erd.json',
      saveState: 'saved',
      pendingAttempt: null,
    });
    expect(tableNames((snapshot as { value: string }).value)).toEqual([
      'users',
    ]);
  });

  it('acks before it serializes the document or saves', async () => {
    const a = await open('a');
    const getValue = vi.spyOn(a.editor.adapter, 'getValue');
    const raw = rawTab();
    const atPost: Array<{ type: string; reads: number; requests: number }> = [];
    env.onSend.current = (tab, message) => {
      if (tab !== 'a' || message.type === 'actions') return;
      atPost.push({
        type: message.type,
        reads: getValue.mock.calls.length,
        requests: env.drive.calls.length,
      });
    };
    const requests = env.drive.calls.length;
    a.addTable('orders');

    raw.channel.post({ type: 'hello', from: 'raw' });
    raw.channel.post({ type: 'save-request' });
    await settle(20);

    expect(atPost.slice(0, 3)).toEqual([
      { type: 'status', reads: 0, requests },
      { type: 'status', reads: 0, requests },
      { type: 'snapshot', reads: 1, requests },
    ]);
    expect(env.patches()).toHaveLength(1);
  });

  it('sends nothing before its snapshot, and applies what came before it after', async () => {
    const a = await open('a', { autoAttach: false });
    const b = await open('b');
    expect(b.snapshot()).toMatchObject({ phase: 'loading', role: 'follower' });
    // A third tab's edit of a's load reaches b before b has the document.
    const other = createPeerEditor('other');
    other.store.setInitialValue(USERS_DOCUMENT);
    const raw = rawTab(() => a.snapshot().epoch);
    other.adapter.subscribeLocal(actions =>
      raw.channel.post({ type: 'actions', actions })
    );
    other.addTable('orders');
    await settle(5);

    a.mount();
    await settle(20);

    const snapshotAt = env.sent.findIndex(
      ({ message }) => message.type === 'snapshot'
    );
    const firstSendOfB = env.sent.findIndex(
      ({ tab, message }) => tab === 'b' && message.type === 'actions'
    );
    expect(snapshotAt).toBeGreaterThan(-1);
    expect(firstSendOfB).toBeGreaterThan(snapshotAt);
    expect(tableNames(b.value())).toEqual(['orders', 'users']);
    other.destroy();
  });

  it('attaches in the order the shared store needs: the value, the subscription, then what came before', async () => {
    const a = await open('a');
    const b = await open('b', { autoAttach: false });
    expect(b.snapshot().phase).toBe('ready');
    a.addTable('orders');
    await settle(5);
    const editor = createPeerEditor('b');
    const calls: string[] = [];
    const recording = Object.fromEntries(
      Object.entries(editor.adapter).map(([key, method]) => [
        key,
        (...args: unknown[]) => {
          calls.push(key);
          return (method as (...args: unknown[]) => unknown)(...args);
        },
      ])
    ) as unknown as EditorAdapter;

    b.controller.attach(recording);

    // The add and the rename came as two batches.
    expect(calls).toEqual([
      'setInitialValue',
      'subscribeLocal',
      'applyRemote',
      'applyRemote',
      'onChange',
    ]);
    expect(tableNames(editor.store.value)).toEqual(['orders', 'users']);
    editor.destroy();
  });

  it('takes the epoch from a snapshot or a reload alone, and drops edits of any other', async () => {
    const a = await open('a');
    const b = await open('b');
    const { epoch } = b.snapshot();
    const other = createPeerEditor('other');
    other.store.setInitialValue(USERS_DOCUMENT);
    const stale = rawTab(() => 'elsewhere');
    other.adapter.subscribeLocal(actions =>
      stale.channel.post({ type: 'actions', actions })
    );

    other.addTable('orders');
    stale.channel.post({ type: 'status', state: 'saved', at: 1 });
    await settle(5);

    expect(b.snapshot().epoch).toBe(epoch);
    expect(tableNames(b.value())).toEqual(['users']);
    expect(tableNames(a.value())).toEqual(['users']);

    // A reload is a new epoch every tab takes, and the old one's edits stay out.
    const current = rawTab(() => epoch);
    other.adapter.subscribeLocal(actions =>
      current.channel.post({ type: 'actions', actions })
    );
    await a.controller.reload();
    await settle(5);
    other.addTable('items');
    await settle(5);

    expect(b.snapshot().epoch).not.toBe(epoch);
    expect(b.snapshot().epoch).toBe(a.snapshot().epoch);
    expect(tableNames(b.value())).toEqual(['users']);
    other.destroy();
  });

  it('hands a new tab the save state and the attempt under way', async () => {
    const a = await open('a');
    const release = env.drive.hold('PATCH');
    a.addTable('orders');
    await settle(2000);
    const raw = rawTab();

    raw.channel.post({ type: 'hello', from: 'raw' });
    await settle(5);

    const snapshot = raw.heard.find(
      message => message.type === 'snapshot'
    ) as Extract<FileMessage, { type: 'snapshot' }>;
    expect(snapshot.saveState).toBe('saving');
    expect(snapshot.pendingAttempt).toEqual({
      attemptId: expect.any(String),
      fingerprint: expect.any(String),
    });
    release();
    await settle(5);
  });

  it('shows a tab that joins after a conflict the conflict', async () => {
    const a = await open('a');
    env.drive.bumpRemote('file-1');
    a.addTable('orders');
    await settle(2000);
    expect(a.snapshot().saveState).toBe('conflict');

    const c = await open('c');

    expect(c.snapshot()).toMatchObject({
      role: 'follower',
      saveState: 'conflict',
    });
    expect(c.controller.hasUnsavedChanges()).toBe(true);
  });

  describe('a follower closing', () => {
    it('holds an edit until the leader’s status follows it', async () => {
      const a = await open('a');
      const b = await open('b');
      expect(b.controller.hasUnsavedChanges()).toBe(false);

      b.addTable('orders');
      expect(b.controller.hasUnsavedChanges()).toBe(true);
      await settle(FOLLOWER_SEND_WINDOW_MS);
      expect(b.controller.hasUnsavedChanges()).toBe(true);

      await settle(2000);
      expect(a.snapshot().saveState).toBe('saved');
      expect(b.snapshot().saveState).toBe('saved');
      expect(b.controller.hasUnsavedChanges()).toBe(false);
    });

    it('holds while the leader does not answer, and says so', async () => {
      const a = await open('a');
      const b = await open('b');
      a.freeze();

      b.addTable('orders');
      await settle(2000 + ACK_TIMEOUT_MS);

      expect(b.snapshot().saveState).toBe('waiting-leader');
      expect(b.controller.hasUnsavedChanges()).toBe(true);
    });
  });
});
