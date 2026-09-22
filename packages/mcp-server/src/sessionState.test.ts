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
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import { CLOSED_NOTE, createLiveSession, RESEED_NOTE } from '@/session/live';
import { FELL_BACK_NOTE } from '@/session/manager';

const DOCUMENT = '/work/state.erd.json';

let io: MemoryIo;
let hub: FakeHub;
const harnesses: McpHarness[] = [];

async function connect(clientName = 'claude-code') {
  const mcp = await connectMcp({ io, clientName });
  harnesses.push(mcp);
  return mcp;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryIo();
  io.put(DOCUMENT, emptyDocument());
  hub = createFakeHub(io, { pid: 6161, workspaceFolders: ['/work'] });
});

afterEach(async () => {
  for (const mcp of harnesses.splice(0)) await mcp.close();
  hub.destroy();
  vi.restoreAllMocks();
});

const candidate = () => ({
  pid: hub.pid,
  record: hub.lock(),
  mtimeMs: 1,
});

describe('LiveSession transitions (AC-P13)', () => {
  it('leave: ready to detached, and the next write joins again', async () => {
    const session = createLiveSession({
      io,
      path: DOCUMENT,
      candidate: candidate(),
      nickname: 'agent',
      client: 'agent',
    });
    await session.runTool('erd_add_table', {});
    expect(session.state).toBe('ready');

    await session.leave();
    expect(session.state).toBe('detached');
    expect(hub.documents.get(DOCUMENT)!.peers.size).toBe(0);

    const { run } = await session.runTool('erd_add_memo', {});
    expect(run.batches).toBe(1);
    expect(session.state).toBe('ready');
    expect(hub.methods().slice(-4)).toEqual([
      'leave',
      'openDocument',
      'join',
      'applyActions',
    ]);
    await session.close();
  });

  it('documentClosed: ready to reconnecting, and the next write opens and joins again', async () => {
    const session = createLiveSession({
      io,
      path: DOCUMENT,
      candidate: candidate(),
      nickname: 'agent',
      client: 'agent',
    });
    await session.runTool('erd_add_table', {});

    hub.close(DOCUMENT);
    await settle();
    expect(session.state).toBe('reconnecting');

    const { notes } = await session.runTool('erd_add_memo', {});
    expect(notes).toEqual([CLOSED_NOTE, RESEED_NOTE]);
    expect(session.state).toBe('ready');
    expect(hub.webview(DOCUMENT).state.doc.memoIds).toHaveLength(1);
    await session.close();
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
    expect(refused.json.error.code).toBe('hubGone');
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
    expect(memo).toMatchObject({ mode: 'headless', notes: [FELL_BACK_NOTE] });
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
