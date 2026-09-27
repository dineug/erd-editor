import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  HUB_PROTOCOL_VERSION,
  type LockCandidate,
  lockDirPath,
  lockFilePath,
  type LockRecord,
  pipePath,
  serializeLock,
} from '@dineug/erd-editor-agent-hub';
import * as NodePath from '@effect/platform-node/NodePath';
import { Effect, Layer } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { createFakeHub, type FakeHub } from '@/__test-utils__/fakeHub';
import {
  connectLayer,
  connectMcp,
  type McpHarness,
} from '@/__test-utils__/mcp';
import { fsError } from '@/__test-utils__/memoryFs';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { findAlias } from '@/hub/alias';
import * as HubConnector from '@/hub/client';
import { HubDiscovery } from '@/hub/discovery';
import * as NodeFs from '@/io/fileSystem';
import * as ProcessInfo from '@/io/process';
import { makeServerLayer } from '@/server';
import { diskReadNote } from '@/session/manager';

type CandidateInit = {
  pid: number;
  folders?: string[];
  documents?: string[];
  mtimeMs?: number;
};

function candidate({
  pid,
  folders = [],
  documents = [],
  mtimeMs = 1000,
}: CandidateInit): LockCandidate {
  return {
    pid,
    mtimeMs,
    record: {
      pipe: `\\\\.\\pipe\\erd-editor-ide-${pid}`,
      workspaceFolders: folders,
      documents,
      ide: 'vscode',
      version: '3.0.0',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: 't',
      hub: true,
    },
  };
}

/** One volume reached as C: and through the admin share, each path's identity by its spelling. */
const IDENTITIES = new Map([
  ['C:\\ws', 'v1:10'],
  ['\\\\localhost\\C$\\ws', 'v1:10'],
  ['C:\\ws\\app', 'v1:11'],
  ['\\\\localhost\\C$\\ws\\app', 'v1:11'],
  ['C:\\ws\\app\\model.erd.json', 'v1:12'],
  ['\\\\localhost\\C$\\ws\\app\\model.erd.json', 'v1:12'],
  ['C:\\other', 'v1:20'],
]);

/** findAlias over IDENTITIES, with every path it asked about, the target's and the locks'. */
async function find(target: string, candidates: LockCandidate[]) {
  const asked: string[] = [];
  const listed: string[] = [];
  const found = await Effect.runPromise(
    findAlias(
      target,
      candidates,
      path =>
        Effect.sync(() => {
          asked.push(path);
          return IDENTITIES.get(path) ?? null;
        }),
      (_, path) =>
        Effect.sync(() => {
          listed.push(path);
          return IDENTITIES.get(path) ?? null;
        })
    )
  );
  return {
    pid: found?.candidate.pid ?? null,
    spelled: found?.spelled ?? null,
    asked,
    listed,
  };
}

const SHARE_DOCUMENT = '\\\\localhost\\C$\\ws\\app\\model.erd.json';

describe('findAlias, a window holding a path the other way', () => {
  it('finds a drive folder holding a share path, spelled under the folder', async () => {
    const found = await find(SHARE_DOCUMENT, [
      candidate({ pid: 1, folders: ['C:\\ws'] }),
    ]);
    expect(found).toMatchObject({
      pid: 1,
      spelled: 'C:\\ws\\app\\model.erd.json',
    });
    expect(found.asked).toEqual([
      SHARE_DOCUMENT,
      '\\\\localhost\\C$\\ws\\app',
      '\\\\localhost\\C$\\ws',
      '\\\\localhost\\C$\\',
    ]);
  });

  it('finds a document not created yet through the folder above it', async () => {
    const found = await find('\\\\localhost\\C$\\ws\\new\\x.erd.json', [
      candidate({ pid: 1, folders: ['C:\\ws'] }),
    ]);
    expect(found).toMatchObject({ pid: 1, spelled: 'C:\\ws\\new\\x.erd.json' });
  });

  it('finds an open document as itself, never as a folder of the paths below it', async () => {
    expect(
      await find(SHARE_DOCUMENT, [
        candidate({ pid: 2, documents: ['C:\\ws\\app\\model.erd.json'] }),
      ])
    ).toMatchObject({ pid: 2, spelled: 'C:\\ws\\app\\model.erd.json' });
    expect(
      await find(SHARE_DOCUMENT, [
        candidate({ pid: 2, documents: ['C:\\ws\\app'] }),
      ])
    ).toMatchObject({ pid: null });
  });

  it('finds a share folder holding a drive path, the other way round', async () => {
    const found = await find('C:\\ws\\app\\model.erd.json', [
      candidate({ pid: 3, folders: ['\\\\localhost\\C$\\ws'] }),
    ]);
    expect(found).toMatchObject({ pid: 3, spelled: SHARE_DOCUMENT });
  });

  it('ranks as selectHub does: a document, then the deeper folder, then the newer lock, then the higher pid', async () => {
    const shallow = candidate({ pid: 1, folders: ['C:\\ws'], mtimeMs: 9000 });
    const deep = candidate({ pid: 2, folders: ['C:\\ws\\app'] });
    const holder = candidate({
      pid: 3,
      documents: ['C:\\ws\\app\\model.erd.json'],
    });
    const older = candidate({ pid: 7, folders: ['C:\\ws'] });
    const newer = candidate({ pid: 4, folders: ['C:\\ws'], mtimeMs: 2000 });
    const pid5 = candidate({ pid: 5, folders: ['C:\\ws'] });
    const pid6 = candidate({ pid: 6, folders: ['C:\\ws'] });

    expect((await find(SHARE_DOCUMENT, [shallow, deep])).pid).toBe(2);
    expect((await find(SHARE_DOCUMENT, [deep, shallow])).pid).toBe(2);
    expect((await find(SHARE_DOCUMENT, [deep, holder])).pid).toBe(3);
    expect((await find(SHARE_DOCUMENT, [older, newer])).pid).toBe(4);
    expect((await find(SHARE_DOCUMENT, [pid6, pid5])).pid).toBe(6);
  });

  it('asks nothing when every listed path is spelled the way the target is', async () => {
    const found = await find('C:\\ws\\app\\model.erd.json', [
      candidate({ pid: 1, folders: ['C:\\ws', 'D:\\data'] }),
    ]);
    expect(found).toEqual({ pid: null, spelled: null, asked: [], listed: [] });
  });

  it('asks only about listed paths of the other kind, and about no path of the target when none can be read', async () => {
    const found = await find(SHARE_DOCUMENT, [
      candidate({ pid: 1, folders: ['C:\\gone', 'C:\\ws'] }),
      candidate({ pid: 2, folders: ['\\\\localhost\\C$\\elsewhere'] }),
    ]);
    expect(found.pid).toBe(1);
    expect(found.listed).toEqual(['C:\\gone', 'C:\\ws']);

    const none = await find(SHARE_DOCUMENT, [
      candidate({ pid: 1, folders: ['C:\\gone'] }),
    ]);
    expect(none).toMatchObject({ pid: null, asked: [] });
  });

  it('finds none for a folder that is another file', async () => {
    expect(
      await find(SHARE_DOCUMENT, [
        candidate({ pid: 1, folders: ['C:\\other'] }),
      ])
    ).toMatchObject({ pid: null, spelled: null });
  });

  it('finds none through a lock path selectHub never matches, as one holding ..', async () => {
    IDENTITIES.set('C:\\ws\\app\\..\\app', 'v1:11');
    try {
      expect(
        await find(SHARE_DOCUMENT, [
          candidate({ pid: 1, folders: ['C:\\ws\\app\\..\\app'] }),
        ])
      ).toMatchObject({ pid: null, spelled: null });
    } finally {
      IDENTITIES.delete('C:\\ws\\app\\..\\app');
    }
  });
});

const WINDOW_FOLDER = 'C:\\ws';
const WINDOW_DOCUMENT = 'C:\\ws\\app\\model.erd.json';

describe('discovery on win32, a window holding a path the other way', () => {
  let win: MemoryHost;

  beforeEach(() => {
    win = createMemoryHost({ platform: 'win32' });
    for (const [path, identity] of IDENTITIES)
      win.identities.set(path, identity);
  });

  const lockOf = (pid: number, folders: string[], hub = true): LockRecord => ({
    pipe: hub ? pipePath(win.home, pid, 'win32') : '',
    workspaceFolders: folders,
    documents: [],
    ide: 'vscode',
    version: '3.0.0',
    protocolVersion: HUB_PROTOCOL_VERSION,
    token: hub ? 't' : '',
    hub,
  });

  const discover = (host: MemoryHost, targetPath: string) =>
    host.run(
      Effect.gen(function* () {
        const discovery = yield* HubDiscovery;
        return yield* discovery.discover(targetPath);
      })
    );

  it('answers with that window, live or blocked, and the path it holds the target by', async () => {
    win.alive.add(1).add(2);
    win.writeLock(1, lockOf(1, [WINDOW_FOLDER]));

    expect(await discover(win, SHARE_DOCUMENT)).toEqual({
      kind: 'live',
      candidate: expect.objectContaining({ pid: 1 }),
      alias: WINDOW_DOCUMENT,
    });

    win.removeLock(1);
    win.writeLock(2, lockOf(2, [WINDOW_FOLDER], false));
    expect(await discover(win, SHARE_DOCUMENT)).toEqual({
      kind: 'blocked',
      candidate: expect.objectContaining({ pid: 2 }),
      alias: WINDOW_DOCUMENT,
    });
  });

  it('asks for no identity off win32, nor when a lock names the path as it is spelled', async () => {
    const linux = createMemoryHost();
    for (const [path, identity] of IDENTITIES)
      linux.identities.set(path, identity);
    linux.alive.add(1);
    linux.writeLock(1, { ...lockOf(1, [WINDOW_FOLDER]), pipe: '/p.sock' });
    const asked = vi.spyOn(linux.identities, 'get');
    expect(await discover(linux, SHARE_DOCUMENT)).toEqual({ kind: 'headless' });
    expect(asked).not.toHaveBeenCalled();

    win.alive.add(2);
    win.writeLock(2, lockOf(2, ['\\\\localhost\\C$\\ws', WINDOW_FOLDER]));
    const winAsked = vi.spyOn(win.identities, 'get');
    expect(await discover(win, SHARE_DOCUMENT)).toEqual({
      kind: 'live',
      candidate: expect.objectContaining({ pid: 2 }),
    });
    expect(winAsked).not.toHaveBeenCalled();
  });

  it('asks for a lock path once per version of the lock, and forgets the versions gone', async () => {
    win.alive.add(1);
    win.writeLock(1, lockOf(1, [WINDOW_FOLDER]), 5_000);
    const asked = vi.spyOn(win.identities, 'get');
    const lockPathAsks = () =>
      asked.mock.calls.filter(([path]) => path === WINDOW_FOLDER).length;

    // One discovery for the whole run, as the server keeps one.
    const counts = await win.run(
      Effect.gen(function* () {
        const discovery = yield* HubDiscovery;
        const counted: number[] = [];
        const rewrite = (mtimeMs: number) =>
          Effect.sync(() =>
            win.writeLock(1, lockOf(1, [WINDOW_FOLDER]), mtimeMs)
          );

        yield* discovery.discover(SHARE_DOCUMENT);
        yield* discovery.discover(SHARE_DOCUMENT);
        counted.push(lockPathAsks());
        yield* rewrite(6_000);
        yield* discovery.discover(SHARE_DOCUMENT);
        counted.push(lockPathAsks());
        yield* rewrite(5_000);
        yield* discovery.discover(SHARE_DOCUMENT);
        counted.push(lockPathAsks());
        return counted;
      })
    );

    expect(counts).toEqual([1, 2, 3]);
    // The target's chain is asked on every call: files come and go.
    expect(
      asked.mock.calls.filter(([path]) => path === SHARE_DOCUMENT)
    ).toHaveLength(4);
  });

  it('leaves out the locks it found stale', async () => {
    win.writeLock(1, lockOf(1, [WINDOW_FOLDER]));
    win.alive.add(2);
    win.put(lockFilePath(win.home, 2), '{"pipe":');

    expect(await discover(win, SHARE_DOCUMENT)).toEqual({ kind: 'headless' });
    expect(win.files.has(lockFilePath(win.home, 1))).toBe(false);
  });
});

describe('a call naming a document the other way (win32)', () => {
  const DOCUMENT = '/work/app/db/model.erd.json';
  const SHARE_WORK = '\\\\localhost\\C$\\work';
  const SPELLED = `${SHARE_WORK}\\app\\db\\model.erd.json`;
  let win: MemoryHost;
  let mcp: McpHarness;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    win = createMemoryHost({ platform: 'win32' });
    win.put(DOCUMENT, emptyDocument());
    win.identities.set('/work', 'v1:1').set(SHARE_WORK, 'v1:1');
    mcp = await connectMcp({ host: win });
  });

  afterEach(async () => {
    await mcp.close();
    vi.restoreAllMocks();
  });

  it('refuses reads and writes with invalidPath naming the path the window holds, writing nothing', async () => {
    const hub = createFakeHub(win, {
      pid: 8181,
      workspaceFolders: [SHARE_WORK],
    });
    const onDisk = win.read(DOCUMENT);
    const writes = win.writes.length;

    for (const [tool, args] of [
      ['erd_add_table', {}],
      ['erd_open_document', { create: true }],
      ['erd_read', { format: 'snapshot' }],
      ['erd_list', {}],
    ] as const) {
      const refused = await mcp.call(tool, { path: DOCUMENT, ...args });
      expect(refused.isError).toBe(true);
      expect(refused.json.error).toEqual({
        code: 'invalidPath',
        message: `${DOCUMENT} is ${SPELLED} reached another way, such as through a network share or a mapped drive of this computer, and a VS Code window (pid 8181) holds it under that path; call again with ${SPELLED}.`,
      });
    }
    expect(win.read(DOCUMENT)).toBe(onDisk);
    expect(win.writes.length).toBe(writes);
    expect(hub.methods()).toEqual([]);
    expect(mcp.manager.paths()).toEqual([]);
    hub.destroy();
  });

  it('closes a disk session once a window holds its document the other way', async () => {
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    expect(mcp.manager.paths()).toEqual([DOCUMENT]);
    const hub = createFakeHub(win, {
      pid: 8282,
      workspaceFolders: [SHARE_WORK],
      ide: 'intellij',
    });

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.message).toContain(
      'and a JetBrains IDE (pid 8282) holds it under that path'
    );
    expect(mcp.manager.paths()).toEqual([]);
    hub.destroy();
  });

  it('refuses a retried write the same way once a window holds the document the other way', async () => {
    await mcp.ok('erd_add_memo', { path: DOCUMENT });
    const onDisk = win.read(DOCUMENT);
    const rename = win.calls.rename;
    let hub: FakeHub | undefined;
    win.calls.rename = from => {
      win.calls.rename = rename;
      // The editor opened the folder the other way, which held the file.
      hub = createFakeHub(win, { pid: 8484, workspaceFolders: [SHARE_WORK] });
      return Effect.fail(fsError('Unknown', 'rename', from, 'EPERM'));
    };

    const refused = await mcp.call('erd_add_table', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('invalidPath');
    expect(refused.json.error.message).toContain(
      `(pid 8484) holds it under that path; call again with ${SPELLED}.`
    );
    expect(win.read(DOCUMENT)).toBe(onDisk);
    expect([...win.files.keys()].filter(path => path.endsWith('.tmp'))).toEqual(
      []
    );
    hub?.destroy();
  });

  it('lists the documents of a working folder held the other way through that window', async () => {
    const hub = createFakeHub(win, {
      pid: 8383,
      workspaceFolders: [SHARE_WORK],
    });

    const listed = await mcp.ok('erd_list_documents');
    expect(listed.mode).toBe('live');
    expect(hub.methods()).toEqual(['listDocuments']);
    hub.destroy();
  });
});

describe('the share spelling of a folder on this disk (Windows)', () => {
  let dir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    dir = await realpath(await mkdtemp(join(tmpdir(), 'erd-alias-')));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  // Only Windows reaches a folder of this computer by a share spelling, here
  // the admin share of its drive; the memory specs above hold the rule everywhere.
  it.runIf(process.platform === 'win32')(
    'refuses the admin share spelling of a folder a window holds, naming the drive path, which that window answers',
    async () => {
      const home = join(dir, 'home');
      const ws = join(dir, 'ws');
      const document = join(ws, 'model.erd.json');
      const text = emptyDocument();
      await mkdir(lockDirPath(home), { recursive: true });
      await mkdir(ws);
      await writeFile(document, text);
      const pid = 424_242;
      await writeFile(
        lockFilePath(home, pid),
        serializeLock({
          pipe: '',
          workspaceFolders: [ws],
          documents: [],
          ide: 'vscode',
          version: '3.0.0',
          protocolVersion: HUB_PROTOCOL_VERSION,
          token: '',
          hub: false,
        })
      );
      const shared = await realpath(
        `\\\\localhost\\${ws[0]}$${document.slice(2)}`
      );
      const platform = Layer.mergeAll(
        NodeFs.layer,
        NodePath.layer,
        ProcessInfo.layerTest({
          cwd: ws,
          homeDir: home,
          platform: 'win32',
          isAlive: alive => alive === pid,
        }),
        HubConnector.layer
      );
      const mcp = await connectLayer(makeServerLayer(platform));

      try {
        const refused = await mcp.call('erd_add_table', { path: shared });
        expect(refused.json.error).toEqual({
          code: 'invalidPath',
          message: `${shared} is ${document} reached another way, such as through a network share or a mapped drive of this computer, and a VS Code window (pid ${pid}) holds it under that path; call again with ${document}.`,
        });

        const read = await mcp.call('erd_read', {
          path: document,
          format: 'snapshot',
        });
        expect(read.isError).toBe(false);
        expect(JSON.parse(read.texts[1]).notes).toEqual([
          diskReadNote('vscode'),
        ]);
        const blocked = await mcp.call('erd_add_table', { path: document });
        expect(blocked.json.error.code).toBe('blocked');
        expect(await readFile(document, 'utf8')).toBe(text);
      } finally {
        await mcp.close();
      }
    }
  );
});
