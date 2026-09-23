import {
  HUB_PROTOCOL_VERSION,
  lockDirPath,
  lockFilePath,
  pipePath,
} from '@dineug/erd-editor-agent-hub';
import * as Effect from 'effect/Effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { createFakeHub } from '@/__test-utils__/fakeHub';
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { HubDiscovery } from '@/hub/discovery';
import { CLOSED_NOTE, RESEED_NOTE } from '@/session/live';

const DOCUMENT = '/work/app/db/model.erd.json';

let io: MemoryHost;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(DOCUMENT, emptyDocument());
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** What discovery picks for targetPath on host, deleting what it deletes. */
const discover = (host: MemoryHost, targetPath: string) =>
  host.run(
    Effect.gen(function* () {
      const discovery = yield* HubDiscovery;
      return yield* discovery.discover(targetPath);
    })
  );

const lockOf = (pid: number, folders: string[]) => ({
  pipe: pipePath(io.home, pid, 'linux'),
  workspaceFolders: folders,
  documents: [],
  ide: 'vscode',
  version: '2.9.0',
  protocolVersion: HUB_PROTOCOL_VERSION,
  token: 't',
  hub: true,
});

describe('discovery (AC-M4)', () => {
  it('picks the deepest workspace folder holding the document', async () => {
    io.alive.add(1).add(2);
    io.writeLock(1, lockOf(1, ['/work']));
    io.writeLock(2, lockOf(2, ['/work/app']));

    const selected = await discover(io, DOCUMENT);
    expect(selected).toMatchObject({ kind: 'live', candidate: { pid: 2 } });
  });

  it('deletes the lock, temp file and socket of a dead window, and skips it', async () => {
    io.writeLock(3, lockOf(3, ['/work']));
    io.put(`${lockFilePath(io.home, 3)}.tmp`, '{}');
    io.put(pipePath(io.home, 3, 'linux'), '');

    expect(await discover(io, DOCUMENT)).toEqual({ kind: 'headless' });
    expect(io.files.has(lockFilePath(io.home, 3))).toBe(false);
    expect(io.files.has(`${lockFilePath(io.home, 3)}.tmp`)).toBe(false);
    expect(io.files.has(pipePath(io.home, 3, 'linux'))).toBe(false);
  });

  it('leaves a malformed lock of a live window in place, and says it skipped it', async () => {
    io.alive.add(4);
    io.put(lockFilePath(io.home, 4), '{"pipe":');

    expect(await discover(io, DOCUMENT)).toEqual({ kind: 'headless' });
    expect(io.files.has(lockFilePath(io.home, 4))).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'skipped the lock of pid 4: it does not parse'
    );
  });

  it('keeps a win32 named pipe out of the cleanup, since it is no file', async () => {
    const windows = createMemoryHost({ platform: 'win32' });
    windows.writeLock(5, lockOf(5, ['/work']));
    const remove = vi.spyOn(windows.calls, 'remove');

    await discover(windows, '/work/a.erd.json');
    expect(remove.mock.calls.map(([path]) => path)).toEqual([
      lockFilePath(windows.home, 5),
      `${lockFilePath(windows.home, 5)}.tmp`,
    ]);
  });

  it('finds no window when the lock directory is missing, and skips other files', async () => {
    io.dirs.delete(lockDirPath(io.home));
    expect(await discover(io, DOCUMENT)).toEqual({ kind: 'headless' });

    io.dirs.add(lockDirPath(io.home));
    io.alive.add(6);
    io.put(
      `${lockFilePath(io.home, 6)}.tmp`,
      JSON.stringify(lockOf(6, ['/work']))
    );
    io.put('/home/agent/.erd-editor/ide/notes.txt', 'x');
    expect(await discover(io, DOCUMENT)).toEqual({ kind: 'headless' });
  });

  it('skips a lock deleted between listing and reading', async () => {
    io.alive.add(7);
    io.writeLock(7, lockOf(7, ['/work']));
    const read = io.calls.readFileString;
    io.calls.readFileString = path =>
      Effect.suspend(() => {
        if (path === lockFilePath(io.home, 7)) io.removeLock(7);
        return read(path);
      });
    expect(await discover(io, DOCUMENT)).toEqual({ kind: 'headless' });
  });
});

describe('discovery again on every write (AC-M4)', () => {
  let mcp: McpHarness;

  beforeEach(async () => {
    mcp = await connectMcp({ host: io });
  });

  afterEach(async () => {
    await mcp.close();
  });

  it('refuses a disk write once a hub serves the document, then edits through it', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const onDisk = io.read(DOCUMENT);
    const hub = createFakeHub(io, { pid: 8181, workspaceFolders: ['/work'] });

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('hubAppeared');
    expect(io.read(DOCUMENT)).toBe(onDisk);

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.mode).toBe('live');
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toEqual(memo.createdIds);
    hub.destroy();
  });

  it('refuses a live write once the window turns its hub off', async () => {
    const hub = createFakeHub(io, { pid: 8282, workspaceFolders: ['/work'] });
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    hub.destroy();
    createFakeHub(io, { pid: 8282, workspaceFolders: ['/work'], hub: false });

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('blocked');
  });

  it('reads through a hub that appeared, dropping the disk session with a note', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const hub = createFakeHub(io, { pid: 8383, workspaceFolders: ['/work'] });

    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(JSON.parse(read.texts[1]).notes[0]).toMatch(
      /now serves this document/
    );
    expect(hub.methods()).toEqual(['join']);
    hub.destroy();
  });

  it('follows the document to the window that opened it', async () => {
    const first = createFakeHub(io, { pid: 8484, workspaceFolders: ['/work'] });
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const second = createFakeHub(io, {
      pid: 8585,
      workspaceFolders: ['/elsewhere'],
    });
    first.close(DOCUMENT);
    second.open(DOCUMENT);
    await settle();

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.mode).toBe('live');
    expect(memo.notes).toEqual([CLOSED_NOTE, RESEED_NOTE]);
    expect(second.webview(DOCUMENT).state.doc.memoIds).toEqual(memo.createdIds);
    expect(first.connections.size).toBe(0);
    first.destroy();
    second.destroy();
  });

  it('finds the window of a document named through a symlink, and writes nothing to disk', async () => {
    io.links.set('/link', '/work');
    const hub = createFakeHub(io, { pid: 8787, workspaceFolders: ['/work'] });
    const onDisk = io.read(DOCUMENT);

    const added = await mcp.ok('erd_add_table', {
      path: '/link/app/db/model.erd.json',
    });

    expect(added.mode).toBe('live');
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual(added.createdIds);
    expect(io.read(DOCUMENT)).toBe(onDisk);
    hub.destroy();
  });

  it('reads the file while the window of a dropped live session still runs', async () => {
    const hub = createFakeHub(io, { pid: 8686, workspaceFolders: ['/work'] });
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    io.removeLock(hub.pid);
    hub.disconnectAll();

    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(read.isError).toBe(false);
    expect(read.json.tables).toEqual([]);
    hub.destroy();
  });
});
