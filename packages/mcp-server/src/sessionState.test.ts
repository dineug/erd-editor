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
  comparable,
  connectMcp,
  type McpHarness,
  settle,
} from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { CLOSED_NOTE, makeLiveSession, RESEED_NOTE } from '@/session/live';
import { fellBackNote } from '@/session/manager';
import { documentReader } from '@/tools/read';

const DOCUMENT = '/work/state.erd.json';

let io: MemoryHost;
let hub: FakeHub;
const harnesses: McpHarness[] = [];

async function connect(clientName = 'claude-code') {
  const mcp = await connectMcp({ host: io, clientName });
  harnesses.push(mcp);
  return mcp;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(DOCUMENT, emptyDocument());
  hub = createFakeHub(io, { pid: 6161, workspaceFolders: ['/work'] });
});

afterEach(async () => {
  for (const mcp of harnesses.splice(0)) await mcp.close();
  hub.destroy();
  vi.restoreAllMocks();
});

const live = () =>
  io.run(
    makeLiveSession({
      path: DOCUMENT,
      candidate: { pid: hub.pid, record: hub.lock(), mtimeMs: 1 },
      nickname: 'agent',
      client: 'agent',
    })
  );

describe('LiveSession transitions (AC-P13)', () => {
  it('leave: ready to detached, and the next write joins again', async () => {
    const session = await live();
    await io.run(session.runTool('erd_add_table', {}));
    expect(session.state).toBe('ready');

    await io.run(session.leave);
    expect(session.state).toBe('detached');
    expect(hub.documents.get(DOCUMENT)!.peers.size).toBe(0);

    const { run } = await io.run(session.runTool('erd_add_memo', {}));
    expect(run.batches).toBe(1);
    expect(session.state).toBe('ready');
    expect(hub.methods().slice(-4)).toEqual([
      'leave',
      'openDocument',
      'join',
      'applyActions',
    ]);
    await io.run(session.close);
  });

  it('documentClosed: ready to reconnecting, and the next write opens and joins again', async () => {
    const session = await live();
    await io.run(session.runTool('erd_add_table', {}));

    hub.close(DOCUMENT);
    await settle();
    expect(session.state).toBe('reconnecting');

    const { notes } = await io.run(session.runTool('erd_add_memo', {}));
    expect(notes).toEqual([CLOSED_NOTE, RESEED_NOTE]);
    expect(session.state).toBe('ready');
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toHaveLength(1);
    await io.run(session.close);
  });

  it('documentClosed: a save before the next write says the earlier edits may be gone', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });

    hub.close(DOCUMENT);
    hub.open(DOCUMENT);
    await settle();

    expect(await mcp.ok('erd_save', { path: DOCUMENT })).toEqual({
      tool: 'erd_save',
      mode: 'live',
      saved: true,
      notes: [CLOSED_NOTE],
    });
    expect(JSON.parse(io.read(DOCUMENT)).doc.tableIds).toEqual([]);

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.notes).toEqual([CLOSED_NOTE, RESEED_NOTE]);
    expect(
      (await mcp.ok('erd_save', { path: DOCUMENT })).notes
    ).toBeUndefined();
  });

  it('documentClosed with no edit of its own behind it: no note', async () => {
    const mcp = await connect();
    await mcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' });
    hub.open(DOCUMENT);
    await mcp.ok('erd_open_document', { path: DOCUMENT });

    hub.close(DOCUMENT);
    await settle();

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.notes).toBeUndefined();
  });

  it('a dropped socket: reconnecting, then a new connection to the same window', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });

    hub.disconnectAll();
    await settle();

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.mode).toBe('live');
    expect(memo.notes).toHaveLength(1);
    expect(hub.connections.size).toBe(1);
    expect(hub.methods().filter(method => method === 'join')).toHaveLength(2);
  });

  it('never drops to the file while the window lives, even with its lock gone', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const onDisk = io.read(DOCUMENT);

    io.removeLock(hub.pid);
    hub.disconnectAll();
    await settle();

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'hubGone',
      message: `The VS Code window (pid 6161) that served ${DOCUMENT} still runs, but its lock file is gone and the connection closed, so nothing was written. Reload that window, or close it to edit the file directly.`,
    });
    expect(io.read(DOCUMENT)).toBe(onDisk);
  });

  it('drops to the file only once the window has exited, and says so', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });

    hub.destroy();
    io.removeLock(hub.pid);
    io.alive.delete(hub.pid);
    await settle();

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo).toMatchObject({
      mode: 'headless',
      notes: [
        'The VS Code window that served this document has exited, so this call edited the file on disk instead; edits made through that window can no longer be undone.',
      ],
    });
    expect(memo.notes).toEqual([fellBackNote('vscode', true)]);
    expect(JSON.parse(io.read(DOCUMENT)).doc.memoIds).toEqual(memo.createdIds);
  });

  it('drops to the file under VS Code too once the editor closed the document before the connection went', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });

    hub.close(DOCUMENT);
    await settle();
    io.removeLock(hub.pid);
    hub.disconnectAll();
    await settle();

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo).toMatchObject({
      mode: 'headless',
      notes: [fellBackNote('vscode', false)],
    });
    expect(JSON.parse(io.read(DOCUMENT)).doc.memoIds).toEqual(memo.createdIds);
  });

  it('keeps editing live while connected, though the lock is gone', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    io.removeLock(hub.pid);

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.mode).toBe('live');
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toEqual(memo.createdIds);
  });
});

describe('an editor that lets go of the document, as the Obsidian plugin does when turned off', () => {
  beforeEach(() => {
    hub.destroy();
    io.removeLock(hub.pid);
    io.alive.delete(hub.pid);
    hub = createFakeHub(io, {
      pid: 6262,
      workspaceFolders: ['/work'],
      ide: 'obsidian',
    });
  });

  /** Turned off: every joined peer hears documentClosed, then the lock and the connections go. */
  const turnOff = async () => {
    hub.close(DOCUMENT);
    await settle();
    io.removeLock(hub.pid);
    hub.disconnectAll();
    await settle();
  };

  it('edits the file once the editor said documentClosed and its lock is gone, the process running on', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });

    await turnOff();
    expect(io.alive.has(hub.pid)).toBe(true);

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo).toMatchObject({
      mode: 'headless',
      notes: [
        'The Obsidian window that served this document no longer serves it, so this call edited the file on disk instead; edits made through that window can no longer be undone.',
      ],
    });
    expect(memo.notes).toEqual([fellBackNote('obsidian', false)]);
    expect(JSON.parse(io.read(DOCUMENT)).doc.memoIds).toEqual(memo.createdIds);
  });

  it('reads the file too, and the next write stays on disk', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    await turnOff();

    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(read.isError).toBe(false);
    expect(JSON.parse(read.texts[1]).notes).toEqual([
      fellBackNote('obsidian', false),
    ]);

    const memo = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(memo.mode).toBe('headless');
    expect(memo.notes).toBeUndefined();
  });

  it('refuses a write, naming Obsidian, when the connection closed with no documentClosed first', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    const onDisk = io.read(DOCUMENT);

    io.removeLock(hub.pid);
    hub.disconnectAll();
    await settle();

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error).toEqual({
      code: 'hubGone',
      message: `The Obsidian window (pid 6262) that served ${DOCUMENT} still runs, but its lock file is gone and the connection closed, so nothing was written. Turn the ERD Editor plugin back on, or close that window to edit the file directly.`,
    });
    expect(io.read(DOCUMENT)).toBe(onDisk);
  });

  it('forgets a documentClosed once it connects again, so a later hang-up without one still refuses', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    hub.close(DOCUMENT);
    await settle();
    // The window hangs up and keeps its lock, as a reload of the same pid does.
    hub.disconnectAll();
    await settle();

    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });
    expect(read.isError).toBe(false);
    const onDisk = io.read(DOCUMENT);

    io.removeLock(hub.pid);
    hub.disconnectAll();
    await settle();

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('hubGone');
    expect(io.read(DOCUMENT)).toBe(onDisk);
  });

  it('holds the file again once a write joined the reopened document after documentClosed', async () => {
    const mcp = await connect();
    await mcp.ok('erd_add_table', { path: DOCUMENT });
    hub.close(DOCUMENT);
    await settle();

    const reopened = await mcp.ok('erd_add_memo', { path: DOCUMENT });
    expect(reopened.mode).toBe('live');
    const onDisk = io.read(DOCUMENT);

    io.removeLock(hub.pid);
    hub.disconnectAll();
    await settle();

    const refused = await mcp.call('erd_add_memo', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('hubGone');
    expect(io.read(DOCUMENT)).toBe(onDisk);
  });

  it('says which editor it serves, and whether that editor let go of the document since a write joined', async () => {
    const session = await live();
    await io.run(session.runTool('erd_add_table', {}));
    expect(session).toMatchObject({ ide: 'obsidian', released: false });

    hub.close(DOCUMENT);
    await settle();
    expect(session.released).toBe(true);

    await io.run(session.read(documentReader('snapshot')));
    expect(session.released).toBe(true);

    await io.run(session.runTool('erd_add_memo', {}));
    expect(session.released).toBe(false);
    await io.run(session.close);
  });
});

describe('two agents on one document (AC-P13, AC-P17)', () => {
  it('converge with the editor, and each undo reverts only its own edit', async () => {
    const a = await connect('agent-a');
    const b = await connect('agent-b');

    const [tableA] = (await a.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    const [tableB] = (await b.ok('erd_add_table', { path: DOCUMENT }))
      .createdIds;
    await a.ok('erd_change_table_name', {
      path: DOCUMENT,
      tableId: tableB,
      value: 'renamed_by_a',
    });
    await settle();

    const webview = () => comparable(hub.webview(DOCUMENT).value);
    const read = async (mcp: McpHarness) =>
      comparable(
        await mcp.text('erd_read', { path: DOCUMENT, format: 'json' })
      );
    expect(await read(a)).toEqual(webview());
    expect(await read(b)).toEqual(webview());
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual([tableA, tableB]);

    expect(await a.ok('erd_undo', { path: DOCUMENT })).toMatchObject({
      toolName: 'erd_change_table_name',
    });
    expect(await a.ok('erd_undo', { path: DOCUMENT })).toMatchObject({
      toolName: 'erd_add_table',
    });
    await settle();
    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual([tableB]);

    expect(await b.ok('erd_undo', { path: DOCUMENT })).toMatchObject({
      toolName: 'erd_add_table',
    });
    expect((await b.ok('erd_undo', { path: DOCUMENT })).toolName).toBeNull();
    await settle();

    expect(hub.webview(DOCUMENT).state.doc.tableIds).toEqual([]);
    expect(await read(a)).toEqual(webview());
    expect(await read(b)).toEqual(webview());
  });
});
