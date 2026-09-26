import {
  HUB_PROTOCOL_VERSION,
  LOCK_DIR_MODE,
  LOCK_FILE_MODE,
  type LockRecord,
  serializeLock,
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
  createMemoryHost,
  createMemoryHub,
  flush,
  fsError,
  type MemoryHost,
  type MemoryHub,
  memoryLockFile,
  runHub,
  startMemoryHub,
} from '@/__test-utils__/hubLayers';

const HOME = '/home/user';
const LOCK_DIR = `${HOME}/.erd-editor/ide`;
const LOCK = `${LOCK_DIR}/4242.json`;
const SOCKET = `${LOCK_DIR}/4242.sock`;

const record: LockRecord = {
  pipe: SOCKET,
  workspaceFolders: ['/ws'],
  documents: [],
  ide: 'vscode',
  version: '2.9.0',
  protocolVersion: HUB_PROTOCOL_VERSION,
  token: 'secret',
  hub: true,
};

function start(
  io: MemoryHub = createMemoryHub(),
  host: MemoryHost = createMemoryHost()
) {
  return { hub: startMemoryHub(io, { host }), io };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LockFile.write', () => {
  it('writes a 0600 temp file, then renames it over the lock', async () => {
    const io = createMemoryHub();
    io.addDir(LOCK_DIR);
    const lock = await memoryLockFile(io);

    await expect(runHub(lock.write(record))).resolves.toBe(true);

    expect(io.fs.writeFileString).toHaveBeenCalledWith(
      `${LOCK}.tmp`,
      serializeLock(record),
      { mode: LOCK_FILE_MODE }
    );
    expect(io.fs.rename).toHaveBeenCalledWith(`${LOCK}.tmp`, LOCK);
    expect(io.files.get(LOCK)).toMatchObject({ mode: 0o600 });
    expect(io.files.has(`${LOCK}.tmp`)).toBe(false);
  });

  it('deletes a leftover temp first, since writing over it would keep its mode', async () => {
    const io = createMemoryHub();
    io.addFile(`${LOCK}.tmp`, 'half a lock');
    const lock = await memoryLockFile(io);

    await runHub(lock.write(record));

    expect(io.files.get(LOCK)).toEqual({
      data: serializeLock(record),
      mode: LOCK_FILE_MODE,
      socket: false,
    });
  });

  it('answers false and only warns when the temp file cannot be written', async () => {
    const io = createMemoryHub();
    const lock = await memoryLockFile(io);

    await expect(runHub(lock.write(record))).resolves.toBe(false);

    expect(io.fs.rename).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `could not write ${LOCK}`,
      expect.objectContaining({ _tag: 'PlatformError' })
    );
  });
});

describe('LockFile.remove', () => {
  it('deletes the lock and its temp file, and is quiet when neither exists', async () => {
    const io = createMemoryHub();
    io.addFile(LOCK);
    io.addFile(`${LOCK}.tmp`);
    const lock = await memoryLockFile(io);

    await runHub(lock.remove);
    await expect(runHub(lock.remove)).resolves.toBeUndefined();

    expect(io.files.size).toBe(0);
  });
});

describe('LockFile.removeSync', () => {
  it('deletes the lock and its temp file before it returns, and never throws when neither exists', async () => {
    const io = createMemoryHub();
    io.addFile(LOCK);
    io.addFile(`${LOCK}.tmp`);
    const lock = await memoryLockFile(io);

    lock.removeSync();
    expect(io.files.size).toBe(0);
    expect(() => lock.removeSync()).not.toThrow();
    expect(io.env.removeFileSync).toHaveBeenCalledTimes(4);
    expect(io.env.removeFileSync).toHaveBeenNthCalledWith(1, LOCK);
    expect(io.env.removeFileSync).toHaveBeenNthCalledWith(2, `${LOCK}.tmp`);
  });
});

describe('LockFile.cleanStale', () => {
  function seed(io: MemoryHub, pid: number, raw = serializeLock(record)) {
    io.addFile(`${LOCK_DIR}/${pid}.json`, raw);
  }

  const clean = async (io: MemoryHub) => {
    const lock = await memoryLockFile(io);
    await runHub(lock.cleanStale);
  };

  it('deletes the lock, temp file and both possible sockets of a dead pid', async () => {
    const io = createMemoryHub();
    io.addDir('/tmp');
    seed(io, 100);
    io.addFile(`${LOCK_DIR}/100.json.tmp`);
    io.addFile(`${LOCK_DIR}/100.sock`);
    io.addFile('/tmp/erd-editor-ide-100.sock');

    await clean(io);

    expect([...io.files.keys()]).toEqual([]);
  });

  it('leaves the lock of a live window, even a malformed one that may be mid-write', async () => {
    const io = createMemoryHub();
    io.alive.add(200).add(300);
    seed(io, 200);
    seed(io, 300, '{"pipe":');
    io.addFile(`${LOCK_DIR}/200.sock`);

    await clean(io);

    expect([...io.files.keys()].sort()).toEqual([
      `${LOCK_DIR}/200.json`,
      `${LOCK_DIR}/200.sock`,
      `${LOCK_DIR}/300.json`,
    ]);
  });

  it('never touches its own lock or files that are not locks', async () => {
    const io = createMemoryHub();
    io.alive.delete(4242);
    seed(io, 4242);
    io.addFile(`${LOCK_DIR}/notes.txt`);

    await clean(io);

    expect(io.files.has(LOCK)).toBe(true);
    expect(io.files.has(`${LOCK_DIR}/notes.txt`)).toBe(true);
    expect(io.env.isAlive).not.toHaveBeenCalledWith(4242);
  });

  it('skips a lock that its window deleted between the listing and the read, and cleans the rest', async () => {
    const io = createMemoryHub();
    io.alive.add(500);
    seed(io, 500);
    seed(io, 100);
    io.addFile(`${LOCK_DIR}/100.sock`);
    io.fs.readFileString.mockImplementationOnce((path: string) =>
      Effect.fail(fsError('NotFound', 'readFileString', path))
    );

    await clean(io);

    expect(io.fs.readFileString.mock.calls[0][0]).toBe(`${LOCK_DIR}/500.json`);
    expect(io.files.has(`${LOCK_DIR}/500.json`)).toBe(true);
    expect(io.files.has(`${LOCK_DIR}/100.json`)).toBe(false);
    expect(io.files.has(`${LOCK_DIR}/100.sock`)).toBe(false);
  });

  it('does nothing when the lock directory does not exist yet', async () => {
    const io = createMemoryHub();

    await expect(clean(io)).resolves.toBeUndefined();
    expect(io.fs.remove).not.toHaveBeenCalled();
  });

  it('deletes no socket file on win32, where the pipe is no file', async () => {
    const io = createMemoryHub({ platform: 'win32', tmpdir: 'C:\\Temp' });
    seed(io, 100);

    await clean(io);

    expect(io.fs.remove.mock.calls.map(([path]) => path)).toEqual([
      `${LOCK_DIR}/100.json`,
      `${LOCK_DIR}/100.json.tmp`,
    ]);
  });
});

describe('the hub lock file', () => {
  it('creates the lock directory 0700 and the lock 0600', async () => {
    const { io } = start();
    await flush();

    expect(io.fs.makeDirectory).toHaveBeenCalledWith(LOCK_DIR, {
      recursive: true,
      mode: LOCK_DIR_MODE,
    });
    expect(io.dirs.get(LOCK_DIR)).toBe(0o700);
    expect(io.files.get(LOCK)?.mode).toBe(0o600);
  });

  it('names the socket, a random token and the host in the lock', async () => {
    const io = createMemoryHub();
    io.addDir('/ws');
    start(io, createMemoryHost({ ide: 'obsidian', folders: ['/ws'] }));
    await flush();

    expect(io.lock()).toEqual({
      pipe: SOCKET,
      workspaceFolders: ['/ws'],
      documents: [],
      ide: 'obsidian',
      version: '0.0.0-mock',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: 'token-1',
      hub: true,
    });
  });

  it('listens before the lock exists, so the lock never names a pipe that is not there', async () => {
    const { io } = start();
    await flush();

    expect(io.listen.mock.invocationCallOrder[0]).toBeLessThan(
      io.fs.writeFileString.mock.invocationCallOrder[0]
    );
  });

  it('removes a socket file a dead process or an earlier hub left at its path before listening', async () => {
    const io = createMemoryHub();
    io.addFile(SOCKET);
    start(io);
    await flush();

    expect(io.lock()).toMatchObject({ hub: true, pipe: SOCKET });
  });

  it('writes a hub false lock naming no pipe when listening fails, so its paths stay guarded', async () => {
    const io = createMemoryHub();
    io.failListenOnce();
    start(io);
    await flush();

    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(io.files.get(LOCK)?.mode).toBe(0o600);
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `could not listen on ${SOCKET}`,
      expect.any(Error)
    );
  });

  it('neither listens nor writes a lock when the lock directory cannot be created', async () => {
    const io = createMemoryHub();
    io.fs.makeDirectory.mockImplementation((path: string) =>
      Effect.fail(fsError('PermissionDenied', 'makeDirectory', path))
    );
    start(io);
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lock()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `could not write ${LOCK}`,
      expect.objectContaining({ _tag: 'PlatformError' })
    );
  });

  it('closes the pipe again and falls back to hub false when the lock cannot be written after listening', async () => {
    const io = createMemoryHub();
    io.fs.rename.mockImplementationOnce((from: string) =>
      Effect.fail(fsError('Busy', 'rename', from))
    );
    start(io);
    await flush();

    expect(io.servers.size).toBe(0);
    expect(io.files.has(SOCKET)).toBe(false);
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(io.files.has(`${LOCK}.tmp`)).toBe(false);
  });

  it('deletes the locks of dead windows on start', async () => {
    const io = createMemoryHub();
    io.addFile(`${LOCK_DIR}/100.json`, serializeLock(record));
    start(io);
    await flush();

    expect(io.files.has(`${LOCK_DIR}/100.json`)).toBe(false);
    expect(io.files.has(LOCK)).toBe(true);
  });
});

describe('the hub on dispose', () => {
  it('deletes the lock and the socket and hangs up every peer', async () => {
    const { hub, io } = start();
    await flush();
    const client = connectToLock(io);

    await hub.close();

    expect(io.files.has(LOCK)).toBe(false);
    expect(io.files.has(SOCKET)).toBe(false);
    expect(io.servers.size).toBe(0);
    expect(client.closed).toBe(true);
  });

  it('deletes the lock before closing the pipe, so no reader finds a dead pipe', async () => {
    const { hub, io } = start();
    await flush();

    await hub.close();

    const lockGone = io.fs.remove.mock.calls.findIndex(
      ([path]) => path === LOCK
    );
    expect(io.fs.remove.mock.invocationCallOrder[lockGone]).toBeLessThan(
      io.closeListener.mock.invocationCallOrder[0]
    );
  });

  it('deletes a hub false lock too', async () => {
    const { hub, io } = start(
      createMemoryHub(),
      createMemoryHost({ enabled: false })
    );
    await flush();

    await hub.close();

    expect(io.files.size).toBe(0);
  });

  it('is idempotent', async () => {
    const { hub, io } = start();
    await flush();

    await hub.close();
    await hub.close();

    expect(io.listen).toHaveBeenCalledTimes(1);
    expect(io.files.size).toBe(0);
  });

  it('never binds a pipe or writes a lock when disposed right after activate', async () => {
    const { hub, io } = start();

    await hub.close();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.files.size).toBe(0);
    expect(io.servers.size).toBe(0);
  });
});

describe('the documents of the lock', () => {
  it('rewrites the lock atomically on every open and close', async () => {
    const io = createMemoryHub();
    io.addFile('/ws/a.erd.json');
    io.addFile('/ws/b.erd.json');
    const { hub } = start(io);
    await flush();
    io.fs.writeFileString.mockClear();
    io.fs.rename.mockClear();

    await hub.setDocuments(['/ws/a.erd.json']);
    expect(io.lock()?.documents).toEqual(['/ws/a.erd.json']);
    await hub.setDocuments(['/ws/a.erd.json', '/ws/b.erd.json']);
    expect(io.lock()?.documents).toEqual(['/ws/a.erd.json', '/ws/b.erd.json']);
    await hub.setDocuments(['/ws/b.erd.json']);

    expect(io.lock()?.documents).toEqual(['/ws/b.erd.json']);
    expect(
      io.fs.writeFileString.mock.calls.map(([path, , options]) => [
        path,
        options?.mode,
      ])
    ).toEqual(Array(3).fill([`${LOCK}.tmp`, LOCK_FILE_MODE]));
    expect(io.fs.rename.mock.calls).toEqual(
      Array(3).fill([`${LOCK}.tmp`, LOCK])
    );
  });

  it('lists each document under its real path', async () => {
    const io = createMemoryHub();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const { hub } = start(io);

    await hub.setDocuments(['/link/a.erd.json']);

    expect(io.lock()?.documents).toEqual(['/real/a.erd.json']);
  });

  it.each([
    ['writeFileString', 'PermissionDenied'],
    ['rename', 'Busy'],
  ] as const)(
    'resolves and only warns when %s fails, then succeeds on the next call',
    async (method, tag) => {
      const { hub, io } = start();
      await flush();
      io.fs[method].mockImplementationOnce((path: string) =>
        Effect.fail(fsError(tag, method, path))
      );

      await expect(
        hub.setDocuments(['/ws/a.erd.json'])
      ).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(
        '[erd-editor hub]',
        `could not write ${LOCK}`,
        expect.objectContaining({ _tag: 'PlatformError' })
      );
      expect(io.lock()?.documents).toEqual([]);

      await hub.setDocuments(['/ws/a.erd.json']);
      expect(io.lock()?.documents).toEqual(['/ws/a.erd.json']);
    }
  );

  it('recreates the lock directory when the user deleted it', async () => {
    const { hub, io } = start();
    await flush();
    io.files.clear();
    io.dirs.delete(LOCK_DIR);

    await hub.setDocuments(['/ws/a.erd.json']);

    expect(io.lock()).toMatchObject({
      hub: true,
      documents: ['/ws/a.erd.json'],
    });
  });

  it('keeps the documents in the hub false lock of a hub that failed to listen', async () => {
    const io = createMemoryHub();
    io.failListenOnce();
    const { hub } = start(io);

    await hub.setDocuments(['/ws/a.erd.json']);

    expect(io.lock()).toMatchObject({
      hub: false,
      documents: ['/ws/a.erd.json'],
    });
  });

  it('keeps the folders in the hub false lock of a hub that failed to listen', async () => {
    const io = createMemoryHub();
    io.failListenOnce();
    const { hub } = start(io);
    await flush();

    hub.host.roots = ['/ws'];
    hub.host.fireFoldersChange();
    await flush();

    expect(io.lock()).toMatchObject({ hub: false, workspaceFolders: ['/ws'] });
  });

  it('writes nothing once the hub is closed', async () => {
    const { hub, io } = start();
    await flush();
    await hub.close();

    await hub.setDocuments(['/ws/a.erd.json']);

    expect(io.lock()).toBeUndefined();
  });
});
