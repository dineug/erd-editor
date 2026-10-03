import {
  HUB_PROTOCOL_VERSION,
  lockFilePath,
} from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  connectToLock,
  createMemoryDocuments,
  createMemoryHost,
  createMemoryHub,
  flush,
  fsError,
  type MemoryHost,
  type MemoryHub,
  type MemoryHubParts,
  startMemoryHub,
} from '@/__test-utils__/hubLayers';

const LOCK_DIR = '/home/user/.erd-editor/ide';
const LOCK = `${LOCK_DIR}/4242.json`;
const SOCKET = `${LOCK_DIR}/4242.sock`;

function start(io: MemoryHub = createMemoryHub(), parts: MemoryHubParts = {}) {
  return { hub: startMemoryHub(io, parts), io };
}

/** Starts a hub whose host has it off, as an untrusted window or a setting does. */
function startOff(io: MemoryHub = createMemoryHub()) {
  return start(io, { host: createMemoryHost({ enabled: false }) });
}

function turn(host: MemoryHost, enabled: boolean) {
  host.enabled = enabled;
  host.fireEnabledChange();
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the hub by what the host enables', () => {
  it('writes only a hub false lock while the host has it off, and never listens', async () => {
    const { io } = startOff();
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lock()).toEqual({
      pipe: '',
      workspaceFolders: [],
      documents: [],
      ide: 'memory-ide',
      version: '0.0.0-mock',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: '',
      hub: false,
    });
    expect(io.files.get(io.lockPath())?.mode).toBe(0o600);
  });

  it('starts serving once the host turns it on, and the lock then names the pipe and a token', async () => {
    const { hub, io } = startOff();
    await flush();

    turn(hub.host, true);
    await flush();

    expect(io.listen).toHaveBeenCalledWith(SOCKET);
    expect(io.lock()).toMatchObject({
      hub: true,
      pipe: SOCKET,
      token: 'token-1',
    });
  });

  it('says hello with the name of its host', async () => {
    const { io } = start(createMemoryHub(), {
      host: createMemoryHost({ ide: 'obsidian' }),
    });
    await flush();

    const client = connectToLock(io);
    await flush();

    expect(client.received[0]).toMatchObject({
      ok: true,
      method: 'hello',
      result: { ide: 'obsidian', version: '0.0.0-mock' },
    });
  });

  it('keeps a hub false lock when the host turns it on but the pipe cannot listen', async () => {
    const { hub, io } = startOff();
    await flush();
    io.failListenOnce();
    io.fs.rename.mockClear();

    turn(hub.host, true);
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(1);
    expect(io.fs.rename).toHaveBeenCalledTimes(1);
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
  });

  it('retries listening on the next event after a failure', async () => {
    const io = createMemoryHub();
    io.failListenOnce();
    const { hub } = start(io);
    await flush();

    hub.host.fireEnabledChange();
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(2);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-2' });
  });

  it('keeps serving through an event that changes nothing', async () => {
    const { hub, io } = start();
    await flush();

    hub.host.fireEnabledChange();
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(1);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-1' });
  });

  it('turns the lock to hub false before closing the pipe when the host turns it off', async () => {
    const { hub, io } = start();
    await flush();
    const client = io.connect(SOCKET);
    io.fs.rename.mockClear();

    turn(hub.host, false);
    await flush();

    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(client.closed).toBe(true);
    expect(io.servers.has(SOCKET)).toBe(false);
    expect(io.files.has(SOCKET)).toBe(false);
    // A client that reads the lock in between finds hub false, never a pipe
    // that no longer answers.
    expect(io.fs.rename.mock.invocationCallOrder[0]).toBeLessThan(
      io.closeListener.mock.invocationCallOrder[0]
    );
  });

  it('serves again with a new token when the host turns it back on', async () => {
    const { hub, io } = start();
    await flush();
    turn(hub.host, false);
    await flush();

    turn(hub.host, true);
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(2);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-2' });
  });

  it('logs and carries on when asking the host throws', async () => {
    const { hub, io } = start();
    await flush();
    hub.host.isEnabled.mockImplementationOnce(() => {
      throw new Error('settings.json is not JSON');
    });

    hub.host.fireEnabledChange();
    await flush();
    await hub.setDocuments(['/elsewhere/a.erd.json']);

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      expect.objectContaining({ message: 'settings.json is not JSON' })
    );
    expect(io.lock()).toMatchObject({
      hub: true,
      documents: ['/elsewhere/a.erd.json'],
    });
  });

  it('guards with a hub false lock on the next document change when the host cannot answer at start', async () => {
    const host = createMemoryHost();
    host.isEnabled.mockImplementationOnce(() => {
      throw new Error('settings.json is not JSON');
    });
    const { hub, io } = start(createMemoryHub(), { host });
    await flush();
    // The host publishes the documents it already holds as the hub builds,
    // so the guarding lock is there before the host is asked again.
    expect(io.lock()).toMatchObject({ hub: false, documents: [] });

    await hub.setDocuments(['/elsewhere/a.erd.json']);
    expect(io.lock()).toMatchObject({
      hub: false,
      documents: ['/elsewhere/a.erd.json'],
    });

    host.fireEnabledChange();
    await flush();
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-1' });
  });
});

describe('the folders of the lock', () => {
  it('lists the real path of every host folder', async () => {
    const io = createMemoryHub();
    io.addDir('/real/project');
    io.links.set('/link', '/real');
    start(io, { host: createMemoryHost({ folders: ['/link/project'] }) });
    await flush();

    expect(io.lock()?.workspaceFolders).toEqual(['/real/project']);
  });

  it('rewrites the lock when the host reports its folders changed', async () => {
    const io = createMemoryHub();
    io.addDir('/a');
    io.addDir('/b');
    const { hub } = start(io, {
      host: createMemoryHost({ folders: ['/a'] }),
    });
    await flush();

    hub.host.roots = ['/a', '/b'];
    hub.host.fireFoldersChange();
    await flush();

    expect(io.lock()?.workspaceFolders).toEqual(['/a', '/b']);
    expect(io.listen).toHaveBeenCalledTimes(1);
  });

  it('keeps a folder whose realpath fails under the path the host gave', async () => {
    const { io } = start(createMemoryHub(), {
      host: createMemoryHost({ folders: ['/gone'] }),
    });
    await flush();

    expect(io.lock()?.workspaceFolders).toEqual(['/gone']);
  });

  it('logs and keeps the folders it had when the host cannot list them', async () => {
    const io = createMemoryHub();
    io.addDir('/a');
    const { hub } = start(io, {
      host: createMemoryHost({ folders: ['/a'] }),
    });
    await flush();
    hub.host.folders.mockImplementationOnce(() => {
      throw new Error('no folders');
    });

    hub.host.fireFoldersChange();
    await flush();

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      expect.objectContaining({ message: 'no folders' })
    );
    expect(io.lock()?.workspaceFolders).toEqual(['/a']);
  });

  it('is written for a host without folders, and lists the open documents', async () => {
    const io = createMemoryHub();
    io.addFile('/notes/loose.erd.json');
    const { hub } = start(io);

    await hub.setDocuments(['/notes/loose.erd.json']);

    expect(io.lock()).toMatchObject({
      hub: true,
      workspaceFolders: [],
      documents: ['/notes/loose.erd.json'],
    });
  });

  it('lists the documents in a hub false lock too, since that lock guards them', async () => {
    const { hub, io } = startOff();

    await hub.setDocuments(['/notes/loose.erd.json']);

    expect(io.lock()).toMatchObject({
      hub: false,
      documents: ['/notes/loose.erd.json'],
    });
  });
});

describe('the documents the host publishes', () => {
  it('takes the publisher once, and lists what was open when the hub built', async () => {
    const io = createMemoryHub();
    io.addFile('/ws/a.erd.json');
    const documents = createMemoryDocuments(['/ws/a.erd.json']);
    start(io, { documents });
    await flush();

    expect(documents.setPublisher).toHaveBeenCalledTimes(1);
    expect(io.lock()).toMatchObject({
      hub: true,
      documents: ['/ws/a.erd.json'],
    });
  });

  it('resolves a publish at once while a listen is ahead of it, and writes it after', async () => {
    const { hub, io } = startOff();
    await flush();
    let bind!: () => void;
    const listen = io.listen.getMockImplementation()!;
    io.listen.mockImplementationOnce((pipe: string) =>
      Effect.promise(() => new Promise<void>(resolve => (bind = resolve))).pipe(
        Effect.andThen(listen(pipe))
      )
    );
    turn(hub.host, true);
    await flush();

    await hub.documents.publish(['/ws/a.erd.json']);
    expect(io.lock()).toMatchObject({ hub: false, documents: [] });

    bind();
    await flush();
    expect(io.lock()).toMatchObject({
      hub: true,
      documents: ['/ws/a.erd.json'],
    });
  });

  it('waits for the lock to list a document once the hub is up', async () => {
    const { hub, io } = start();
    await flush();
    let write!: () => void;
    io.fs.rename.mockImplementationOnce((from: string, to: string) =>
      Effect.promise(
        () => new Promise<void>(resolve => (write = resolve))
      ).pipe(
        Effect.andThen(
          Effect.sync(() => {
            io.files.set(to, io.files.get(from)!);
            io.files.delete(from);
          })
        )
      )
    );
    let published = false;

    const publishing = hub.documents.publish(['/ws/a.erd.json']).then(() => {
      published = true;
    });
    await flush();
    expect(published).toBe(false);

    write();
    await publishing;
    expect(io.lock()?.documents).toEqual(['/ws/a.erd.json']);
  });

  it('resolves after a second with a warning when a task ahead of the write stalls', async () => {
    const io = createMemoryHub();
    io.addDir('/stalled');
    const { hub } = start(io);
    await flush();
    const realPath = io.fs.realPath.getMockImplementation()!;
    io.fs.realPath.mockImplementation((path: string) =>
      path === '/stalled' ? Effect.never : realPath(path)
    );
    hub.host.roots = ['/stalled'];
    hub.host.fireFoldersChange();
    await flush();
    vi.useFakeTimers();
    let published = false;

    void hub.documents.publish(['/elsewhere/a.erd.json']).then(() => {
      published = true;
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(published).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(published).toBe(true);
    expect(io.lock()?.documents).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'the lock did not list the open documents within 1 second; the editor opens without waiting for it'
    );
  });
});

describe('the hub on close', () => {
  it('lets go of the host, so a later event writes nothing', async () => {
    const { hub, io } = start();
    await flush();
    expect(hub.host.subscriptions()).toBe(2);

    await hub.close();
    turn(hub.host, false);
    hub.host.fireFoldersChange();
    await flush();

    expect(hub.host.subscriptions()).toBe(0);
    expect(io.lock()).toBeUndefined();
  });

  it('lets a host give up on a close a stalled task holds, and deletes the lock once that task returns', async () => {
    const { hub, io } = start();
    await flush();
    let write!: () => void;
    io.fs.rename.mockImplementationOnce((from: string, to: string) =>
      Effect.promise(
        () => new Promise<void>(resolve => (write = resolve))
      ).pipe(
        Effect.andThen(
          Effect.sync(() => {
            io.files.set(to, io.files.get(from)!);
            io.files.delete(from);
          })
        )
      )
    );
    const writing = hub.setDocuments(['/ws/a.erd.json']);
    await flush();
    vi.useFakeTimers();

    // Both hosts' bound, Effect.timeout at 5 seconds: effect runs a scope's
    // finalizers uninterruptibly, so only the hub's own release lets it end.
    const disposing = Effect.runPromise(
      hub.dispose.pipe(
        Effect.as('closed'),
        Effect.timeout('5 seconds'),
        Effect.catchTag('TimeoutError', () => Effect.succeed('gave up'))
      )
    );
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(disposing).resolves.toBe('gave up');
    expect(io.lock()).toMatchObject({ hub: true });
    vi.useRealTimers();
    write();
    await writing;
    await flush();
    expect(io.lock()).toBeUndefined();
    expect(io.servers.size).toBe(0);
  });
});

describe('releaseSync', () => {
  it('deletes the lock and the socket before it returns, and nothing writes the lock after', async () => {
    const { hub, io } = start();
    await flush();
    const documentHub = await hub.ready;

    documentHub.releaseSync();

    expect(io.files.has(LOCK)).toBe(false);
    expect(io.files.has(SOCKET)).toBe(false);
    expect(hub.host.subscriptions()).toBe(0);

    await hub.setDocuments(['/ws/a.erd.json']);
    await hub.documents.publish(['/ws/b.erd.json']);
    turn(hub.host, false);
    await flush();
    expect(io.lock()).toBeUndefined();
  });

  it('deletes again a lock whose write was already on its way to disk', async () => {
    const { hub, io } = start();
    await flush();
    const documentHub = await hub.ready;
    let land!: () => void;
    const write = io.fs.writeFileString.getMockImplementation()!;
    io.fs.writeFileString.mockImplementationOnce((path, data, options) =>
      Effect.promise(() => new Promise<void>(resolve => (land = resolve))).pipe(
        Effect.andThen(write(path, data, options))
      )
    );
    const publishing = hub.documents.publish(['/ws/a.erd.json']);
    await flush();

    documentHub.releaseSync();
    land();
    await publishing;
    await flush();

    expect(io.fs.rename).toHaveBeenLastCalledWith(`${LOCK}.tmp`, LOCK);
    expect(io.lock()).toBeUndefined();
    expect(io.files.has(`${LOCK}.tmp`)).toBe(false);
  });

  it('deletes the socket under the temp directory of a home too long for one', async () => {
    const longHome = `/${'h'.repeat(120)}`;
    const io = createMemoryHub({ homedir: longHome, tmpdir: '/tmp' });
    io.addDir('/tmp');
    const { hub } = start(io);
    await flush();
    expect(io.files.has('/tmp/erd-editor-ide-4242.sock')).toBe(true);

    (await hub.ready).releaseSync();

    expect(io.files.has('/tmp/erd-editor-ide-4242.sock')).toBe(false);
    expect(io.files.has(lockFilePath(longHome, 4242))).toBe(false);
  });

  it('tears down a listen still in flight once it returns, rather than let it write the lock', async () => {
    const { hub, io } = startOff();
    await flush();
    let bind!: () => void;
    const listen = io.listen.getMockImplementation()!;
    io.listen.mockImplementationOnce((pipe: string) =>
      Effect.promise(() => new Promise<void>(resolve => (bind = resolve))).pipe(
        Effect.andThen(listen(pipe))
      )
    );
    turn(hub.host, true);
    await flush();

    (await hub.ready).releaseSync();
    bind();
    await flush();

    expect(io.closeListener).toHaveBeenCalledWith(SOCKET);
    expect(io.servers.size).toBe(0);
    expect(io.files.has(SOCKET)).toBe(false);
    expect(io.lock()).toBeUndefined();
  });

  it('is idempotent, and a close after it still stops the pipe', async () => {
    const { hub, io } = start();
    await flush();
    const client = connectToLock(io);
    const documentHub = await hub.ready;

    documentHub.releaseSync();
    documentHub.releaseSync();
    await hub.close();

    expect(io.env.removeFileSync).toHaveBeenCalledTimes(4);
    expect(client.closed).toBe(true);
    expect(io.servers.size).toBe(0);
    expect(io.files.size).toBe(0);
  });

  it('deletes no socket file for the named pipe of win32', async () => {
    const io = createMemoryHub({ platform: 'win32' });
    const { hub } = start(io);
    await flush();

    (await hub.ready).releaseSync();

    expect(io.env.removeFileSync).toHaveBeenCalledTimes(2);
    expect(io.lock()).toBeUndefined();
  });
});

describe('the repair of a failed lock write', () => {
  /** Advances the fake clock, then lets the memory doubles finish as flush does, over setImmediate. */
  async function settle(ms = 0) {
    await vi.advanceTimersByTimeAsync(ms);
    for (let turn = 0; turn < 10; turn++) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  function failRenames(io: MemoryHub, times = 1) {
    for (let failed = 0; failed < times; failed++) {
      io.fs.rename.mockImplementationOnce((from: string) =>
        Effect.fail(fsError('Busy', 'rename', from))
      );
    }
  }

  /** Makes the next call of a memory double wait until the returned function is called. */
  function holdNext(
    mock: MemoryHub['fs']['rename'] | MemoryHub['listen']
  ): () => void {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const real = mock.getMockImplementation()! as (...args: any[]) => any;
    mock.mockImplementationOnce(((...args: any[]) =>
      Effect.promise(() => gate).pipe(
        Effect.andThen(() => real(...args))
      )) as any);
    return () => release();
  }

  // Only the timers the repair and the retry wait on: effect's scheduler yields through setImmediate.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  it('rewrites the lock a second after a write failed, with no change of state, and warns once, then once it landed', async () => {
    const { hub, io } = start();
    await settle();
    failRenames(io);

    void hub.setDocuments(['/elsewhere/a.erd.json']);
    await settle(999);
    expect(io.lock()?.documents).toEqual([]);
    await settle(1);

    expect(io.lock()).toMatchObject({
      hub: true,
      documents: ['/elsewhere/a.erd.json'],
    });
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenNthCalledWith(
      1,
      '[erd-editor hub]',
      `could not write ${LOCK}`,
      expect.objectContaining({ _tag: 'PlatformError' })
    );
    expect(console.warn).toHaveBeenNthCalledWith(
      2,
      '[erd-editor hub]',
      `wrote ${LOCK} again`
    );
  });

  it('backs off 1, 2 and 4 seconds while the writes keep failing, warning for the first only, and starts over once one landed', async () => {
    const { hub, io } = start();
    await settle();
    const rename = io.fs.rename.getMockImplementation()!;
    io.fs.rename.mockImplementation((from: string) =>
      Effect.fail(fsError('Busy', 'rename', from))
    );
    void hub.setDocuments(['/elsewhere/a.erd.json']);
    await settle();
    io.fs.rename.mockClear();

    for (const [delay, renames] of [
      [1_000, 1],
      [2_000, 2],
      [4_000, 3],
    ]) {
      await settle(delay - 1);
      expect(io.fs.rename).toHaveBeenCalledTimes(renames - 1);
      await settle(1);
      expect(io.fs.rename).toHaveBeenCalledTimes(renames);
    }
    expect(console.warn).toHaveBeenCalledTimes(1);
    io.fs.rename.mockImplementation(rename);
    await settle(8_000);
    expect(io.lock()?.documents).toEqual(['/elsewhere/a.erd.json']);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenLastCalledWith(
      '[erd-editor hub]',
      `wrote ${LOCK} again`
    );

    failRenames(io);
    void hub.setDocuments(['/elsewhere/b.erd.json']);
    await settle(1_000);
    expect(io.lock()?.documents).toEqual(['/elsewhere/b.erd.json']);
    expect(console.warn).toHaveBeenCalledTimes(4);
  });

  it('keeps a failing listen and failing writes quiet on the repairs, each warning once, until a write lands', async () => {
    const io = createMemoryHub();
    for (let listen = 0; listen < 5; listen++) io.failListenOnce('EACCES');
    const rename = io.fs.rename.getMockImplementation()!;
    io.fs.rename.mockImplementation((from: string) =>
      Effect.fail(fsError('PermissionDenied', 'rename', from))
    );
    start(io);
    await settle();
    expect(console.warn).toHaveBeenCalledTimes(2);

    for (const delay of [1_000, 2_000, 4_000]) await settle(delay);
    expect(io.listen).toHaveBeenCalledTimes(4);
    expect(console.warn).toHaveBeenCalledTimes(2);

    io.fs.rename.mockImplementation(rename);
    await settle(8_000);
    expect(io.listen).toHaveBeenCalledTimes(5);
    expect(io.lock()).toMatchObject({ hub: false });
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenLastCalledWith(
      '[erd-editor hub]',
      `wrote ${LOCK} again`
    );
  });

  it('warns for a listen that fails while the writes keep failing, since that is another failure', async () => {
    const { hub, io } = start();
    await settle();
    io.fs.rename.mockImplementation((from: string) =>
      Effect.fail(fsError('Busy', 'rename', from))
    );
    void hub.setDocuments(['/elsewhere/a.erd.json']);
    await settle();
    expect(console.warn).toHaveBeenCalledTimes(1);

    io.failListenOnce('EACCES');
    turn(hub.host, false);
    await settle();
    turn(hub.host, true);
    await settle();

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenLastCalledWith(
      '[erd-editor hub]',
      `could not listen on ${SOCKET}`,
      expect.objectContaining({ _tag: 'HubListenError' })
    );
  });

  it('closes the pipe at once when the hub false write fails, and the repair turns the lock hub false', async () => {
    const { hub, io } = start();
    await settle();
    const client = io.connect(SOCKET);
    failRenames(io);

    turn(hub.host, false);
    await settle();
    expect(client.closed).toBe(true);
    expect(io.servers.size).toBe(0);
    expect(io.lock()).toMatchObject({ hub: true, pipe: SOCKET });

    await settle(1_000);
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(io.listen).toHaveBeenCalledTimes(1);
  });

  it('listens again on the repair when the hub true write after listening failed, and a publish meanwhile never waits for it', async () => {
    const io = createMemoryHub();
    failRenames(io);
    const { hub } = start(io);
    await settle();
    expect(io.servers.size).toBe(0);
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    const bind = holdNext(io.listen);

    await settle(1_000);
    expect(io.listen).toHaveBeenCalledTimes(2);
    let published = false;
    void hub.documents.publish(['/ws/a.erd.json']).then(() => {
      published = true;
    });
    await settle();
    expect(published).toBe(true);

    bind();
    await settle();
    expect(io.lock()).toMatchObject({
      hub: true,
      pipe: SOCKET,
      token: 'token-2',
      documents: ['/ws/a.erd.json'],
    });
    expect(io.servers.has(SOCKET)).toBe(true);
  });

  it('holds a publish behind a repair that only rewrites until the lock lists it', async () => {
    const { hub, io } = start();
    await settle();
    failRenames(io);
    void hub.setDocuments(['/elsewhere/a.erd.json']);
    await settle();
    const land = holdNext(io.fs.rename);
    await settle(1_000);

    let published = false;
    void hub.documents.publish(['/elsewhere/b.erd.json']).then(() => {
      published = true;
    });
    await settle();
    expect(published).toBe(false);

    land();
    await settle();
    expect(published).toBe(true);
    expect(io.lock()?.documents).toEqual(['/elsewhere/b.erd.json']);
  });

  it.each(['close', 'releaseSync'] as const)(
    'never runs a repair that was due once %s ran',
    async method => {
      const { hub, io } = start();
      await settle();
      failRenames(io);
      void hub.setDocuments(['/elsewhere/a.erd.json']);
      await settle();
      const documentHub = await hub.ready;
      io.fs.rename.mockClear();

      if (method === 'close') void hub.close();
      else documentHub.releaseSync();
      await settle();
      expect(vi.getTimerCount()).toBe(0);
      await settle(30_000);

      expect(io.fs.rename).not.toHaveBeenCalled();
      expect(io.listen).toHaveBeenCalledTimes(1);
      expect(io.lock()).toBeUndefined();
    }
  );

  it('leaves no lock and no temp file when releaseSync comes during a rename Windows keeps refusing', async () => {
    const io = createMemoryHub({ platform: 'win32' });
    const { hub } = start(io);
    await settle();
    const documentHub = await hub.ready;
    io.fs.rename.mockClear();
    for (let refused = 0; refused < 2; refused++) {
      io.fs.rename.mockImplementationOnce((from: string) =>
        Effect.fail(fsError('Unknown', 'rename', from))
      );
    }

    const writing = hub.setDocuments(['/ws/a.erd.json']);
    await settle(15);
    expect(io.fs.rename).toHaveBeenCalledTimes(2);
    documentHub.releaseSync();
    await settle(400);
    await writing;

    expect(io.fs.rename).toHaveBeenCalledTimes(3);
    expect(io.lock()).toBeUndefined();
    expect(io.files.has(`${io.lockPath()}.tmp`)).toBe(false);
  });
});
