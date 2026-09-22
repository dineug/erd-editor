import {
  HUB_PROTOCOL_VERSION,
  LOCK_DIR_MODE,
  LOCK_FILE_MODE,
  type LockRecord,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { startDocumentHub } from '@/hub';
import {
  cleanStaleLocks,
  removeLockFile,
  unlinkQuietly,
  writeLockFile,
} from '@/hub/lockFile';

import {
  connectToLock,
  createHubHandler,
  createMemoryHubIo,
  flush,
  type MemoryHubIo,
} from '../../test/mocks/hubIo';
import {
  createExtensionContext,
  fireWorkspaceFoldersChange,
  resetVscodeMock,
  Uri,
  workspace,
} from '../../test/mocks/vscode';

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

function start(io: MemoryHubIo = createMemoryHubIo()) {
  const hub = startDocumentHub(
    createExtensionContext() as any,
    createHubHandler(),
    io
  );
  return { hub, io };
}

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('writeLockFile', () => {
  it('writes a 0600 temp file, then renames it over the lock', async () => {
    const io = createMemoryHubIo();
    io.addDir(LOCK_DIR);

    await writeLockFile(io, LOCK, record);

    expect(io.writeFile).toHaveBeenCalledWith(
      `${LOCK}.tmp`,
      serializeLock(record),
      LOCK_FILE_MODE
    );
    expect(io.rename).toHaveBeenCalledWith(`${LOCK}.tmp`, LOCK);
    expect(io.files.get(LOCK)).toMatchObject({ mode: 0o600 });
    expect(io.files.has(`${LOCK}.tmp`)).toBe(false);
  });

  it('deletes a leftover temp first, since writing over it would keep its mode', async () => {
    const io = createMemoryHubIo();
    io.addFile(`${LOCK}.tmp`, 'half a lock');

    await writeLockFile(io, LOCK, record);

    expect(io.files.get(LOCK)).toEqual({
      data: serializeLock(record),
      mode: LOCK_FILE_MODE,
      socket: false,
    });
  });

  it('rejects when the temp file cannot be written', async () => {
    const io = createMemoryHubIo();

    await expect(writeLockFile(io, LOCK, record)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(io.rename).not.toHaveBeenCalled();
  });
});

describe('removeLockFile', () => {
  it('deletes the lock and its temp file, and is quiet when neither exists', async () => {
    const io = createMemoryHubIo();
    io.addFile(LOCK);
    io.addFile(`${LOCK}.tmp`);

    await removeLockFile(io, LOCK);
    await removeLockFile(io, LOCK);

    expect(io.files.size).toBe(0);
  });
});

describe('unlinkQuietly', () => {
  it('resolves for a missing file', async () => {
    await expect(
      unlinkQuietly(createMemoryHubIo(), '/nowhere')
    ).resolves.toBeUndefined();
  });
});

describe('cleanStaleLocks', () => {
  function seed(io: MemoryHubIo, pid: number, raw = serializeLock(record)) {
    io.addFile(`${LOCK_DIR}/${pid}.json`, raw);
  }

  it('deletes the lock, temp file and both possible sockets of a dead pid', async () => {
    const io = createMemoryHubIo();
    io.addDir('/tmp');
    seed(io, 100);
    io.addFile(`${LOCK_DIR}/100.json.tmp`);
    io.addFile(`${LOCK_DIR}/100.sock`);
    io.addFile('/tmp/erd-editor-ide-100.sock');

    await cleanStaleLocks(io, HOME, '/tmp', 4242, 'linux');

    expect([...io.files.keys()]).toEqual([]);
  });

  it('leaves the lock of a live window, even a malformed one that may be mid-write', async () => {
    const io = createMemoryHubIo();
    io.alive.add(200).add(300);
    seed(io, 200);
    seed(io, 300, '{"pipe":');
    io.addFile(`${LOCK_DIR}/200.sock`);

    await cleanStaleLocks(io, HOME, '/tmp', 4242, 'linux');

    expect([...io.files.keys()].sort()).toEqual([
      `${LOCK_DIR}/200.json`,
      `${LOCK_DIR}/200.sock`,
      `${LOCK_DIR}/300.json`,
    ]);
  });

  it('never touches its own lock or files that are not locks', async () => {
    const io = createMemoryHubIo();
    io.alive.delete(4242);
    seed(io, 4242);
    io.addFile(`${LOCK_DIR}/notes.txt`);

    await cleanStaleLocks(io, HOME, '/tmp', 4242, 'linux');

    expect(io.files.has(LOCK)).toBe(true);
    expect(io.files.has(`${LOCK_DIR}/notes.txt`)).toBe(true);
    expect(io.isAlive).not.toHaveBeenCalledWith(4242);
  });

  it('skips a lock that its window deleted between the listing and the read, and cleans the rest', async () => {
    const io = createMemoryHubIo();
    io.alive.add(500);
    seed(io, 500);
    seed(io, 100);
    io.addFile(`${LOCK_DIR}/100.sock`);
    io.readFile.mockRejectedValueOnce(
      Object.assign(new Error('gone'), { code: 'ENOENT' })
    );

    await cleanStaleLocks(io, HOME, '/tmp', 4242, 'linux');

    expect(io.readFile.mock.calls[0][0]).toBe(`${LOCK_DIR}/500.json`);
    expect(io.files.has(`${LOCK_DIR}/500.json`)).toBe(true);
    expect(io.files.has(`${LOCK_DIR}/100.json`)).toBe(false);
    expect(io.files.has(`${LOCK_DIR}/100.sock`)).toBe(false);
  });

  it('does nothing when the lock directory does not exist yet', async () => {
    const io = createMemoryHubIo();

    await expect(
      cleanStaleLocks(io, HOME, '/tmp', 4242, 'linux')
    ).resolves.toBeUndefined();
    expect(io.unlink).not.toHaveBeenCalled();
  });

  it('deletes no socket file on win32, where the pipe is no file', async () => {
    const io = createMemoryHubIo();
    seed(io, 100);

    await cleanStaleLocks(io, HOME, 'C:\\Temp', 4242, 'win32');

    expect(io.unlink.mock.calls.map(([path]) => path)).toEqual([
      `${LOCK_DIR}/100.json`,
      `${LOCK_DIR}/100.json.tmp`,
    ]);
  });
});

describe('the hub lock file', () => {
  it('creates the lock directory 0700 and the lock 0600', async () => {
    const { io } = start();
    await flush();

    expect(io.mkdir).toHaveBeenCalledWith(LOCK_DIR, LOCK_DIR_MODE);
    expect(io.dirs.get(LOCK_DIR)).toBe(0o700);
    expect(io.files.get(LOCK)?.mode).toBe(0o600);
  });

  it('names the socket, a random token and this extension in the lock', async () => {
    workspace.workspaceFolders = [{ uri: Uri.file('/ws') }];
    const io = createMemoryHubIo();
    io.addDir('/ws');
    start(io);
    await flush();

    expect(io.lock()).toEqual({
      pipe: SOCKET,
      workspaceFolders: ['/ws'],
      documents: [],
      ide: 'vscode',
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
      io.writeFile.mock.invocationCallOrder[0]
    );
  });

  it('removes a socket file a dead process with this pid left before listening', async () => {
    const io = createMemoryHubIo();
    io.addFile(SOCKET);
    start(io);
    await flush();

    expect(io.lock()).toMatchObject({ hub: true, pipe: SOCKET });
  });

  it('writes a hub false lock naming no pipe when listening fails, so its paths stay guarded', async () => {
    const io = createMemoryHubIo();
    io.listen.mockRejectedValueOnce(new Error('EADDRINUSE'));
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
    const io = createMemoryHubIo();
    io.mkdir.mockRejectedValue(new Error('EACCES'));
    start(io);
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lock()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `could not write ${LOCK}`,
      expect.objectContaining({ message: 'EACCES' })
    );
  });

  it('closes the pipe again and falls back to hub false when the lock cannot be written after listening', async () => {
    const io = createMemoryHubIo();
    io.rename.mockRejectedValueOnce(new Error('ENOSPC'));
    start(io);
    await flush();

    expect(io.servers.size).toBe(0);
    expect(io.files.has(SOCKET)).toBe(false);
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(io.files.has(`${LOCK}.tmp`)).toBe(false);
  });

  it('deletes the locks of dead windows on start', async () => {
    const io = createMemoryHubIo();
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

    hub.dispose();
    await flush();

    expect(io.files.has(LOCK)).toBe(false);
    expect(io.files.has(SOCKET)).toBe(false);
    expect(io.servers.size).toBe(0);
    expect(client.closed).toBe(true);
  });

  it('deletes the lock before closing the pipe, so no reader finds a dead pipe', async () => {
    const { hub, io } = start();
    await flush();
    const handle = await io.listen.mock.results[0].value;

    await hub.close();

    const lockGone = io.unlink.mock.calls.findIndex(([path]) => path === LOCK);
    expect(io.unlink.mock.invocationCallOrder[lockGone]).toBeLessThan(
      handle.close.mock.invocationCallOrder[0]
    );
  });

  it('deletes a hub false lock too', async () => {
    workspace.isTrusted = false;
    const { hub, io } = start();
    await flush();

    await hub.close();

    expect(io.files.size).toBe(0);
  });

  it('is idempotent', async () => {
    const { hub, io } = start();
    await flush();

    const first = hub.close();
    expect(hub.close()).toBe(first);
    await first;

    expect(io.listen).toHaveBeenCalledTimes(1);
  });

  it('never writes a lock when disposed before the start ran', async () => {
    const { hub, io } = start();

    await hub.close();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.files.size).toBe(0);
  });
});

describe('the documents of the lock', () => {
  it('rewrites the lock atomically on every open and close', async () => {
    const io = createMemoryHubIo();
    io.addFile('/ws/a.erd.json');
    io.addFile('/ws/b.erd.json');
    const { hub } = start(io);
    await flush();
    io.writeFile.mockClear();
    io.rename.mockClear();

    await hub.setDocuments(['/ws/a.erd.json']);
    expect(io.lock()?.documents).toEqual(['/ws/a.erd.json']);
    await hub.setDocuments(['/ws/a.erd.json', '/ws/b.erd.json']);
    expect(io.lock()?.documents).toEqual(['/ws/a.erd.json', '/ws/b.erd.json']);
    await hub.setDocuments(['/ws/b.erd.json']);

    expect(io.lock()?.documents).toEqual(['/ws/b.erd.json']);
    expect(
      io.writeFile.mock.calls.map(([path, , mode]) => [path, mode])
    ).toEqual(Array(3).fill([`${LOCK}.tmp`, LOCK_FILE_MODE]));
    expect(io.rename.mock.calls).toEqual(Array(3).fill([`${LOCK}.tmp`, LOCK]));
  });

  it('lists each document under its real path', async () => {
    const io = createMemoryHubIo();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const { hub } = start(io);

    await hub.setDocuments(['/link/a.erd.json']);

    expect(io.lock()?.documents).toEqual(['/real/a.erd.json']);
  });

  it.each([
    ['writeFile', 'ENOSPC'],
    ['rename', 'EACCES'],
  ] as const)(
    'resolves and only warns when %s rejects, then succeeds on the next call',
    async (method, code) => {
      const { hub, io } = start();
      await flush();
      io[method].mockRejectedValueOnce(
        Object.assign(new Error(code), { code })
      );

      await expect(
        hub.setDocuments(['/ws/a.erd.json'])
      ).resolves.toBeUndefined();
      expect(console.warn).toHaveBeenCalledWith(
        '[erd-editor hub]',
        `could not write ${LOCK}`,
        expect.objectContaining({ code })
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
    const io = createMemoryHubIo();
    io.listen.mockRejectedValueOnce(new Error('EADDRINUSE'));
    const { hub } = start(io);

    await hub.setDocuments(['/ws/a.erd.json']);

    expect(io.lock()).toMatchObject({
      hub: false,
      documents: ['/ws/a.erd.json'],
    });
  });

  it('keeps the folders in the hub false lock of a hub that failed to listen', async () => {
    const io = createMemoryHubIo();
    io.listen.mockRejectedValueOnce(new Error('EADDRINUSE'));
    start(io);
    await flush();

    fireWorkspaceFoldersChange([{ uri: Uri.file('/ws') }]);
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
