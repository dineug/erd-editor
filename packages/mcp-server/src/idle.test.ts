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
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import { IDLE_TTL_MS } from '@/session/manager';

const LIVE = '/work/live.erd.json';
const DISK = '/disk/solo.erd.json';

let io: MemoryIo;
let hub: FakeHub;
let mcp: McpHarness;
let clock: number;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  clock = 0;
  io = createMemoryIo();
  io.put(LIVE, emptyDocument());
  io.put(DISK, emptyDocument());
  hub = createFakeHub(io, { pid: 3434, workspaceFolders: ['/work'] });
  mcp = await connectMcp({ io, now: () => clock });
});

afterEach(async () => {
  await mcp.close();
  hub.destroy();
  vi.restoreAllMocks();
});

describe('idle sessions (AC-P15)', () => {
  it('is thirty minutes', () => {
    expect(IDLE_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('closes a session idle for the whole period, live and headless alike', async () => {
    await mcp.ok('erd_add_table', { path: LIVE });
    await mcp.ok('erd_add_table', { path: DISK });
    expect(mcp.erd.manager.paths().sort()).toEqual([DISK, LIVE]);

    clock += IDLE_TTL_MS - 1;
    expect(await mcp.erd.manager.sweep()).toEqual([]);

    clock += 1;
    expect((await mcp.erd.manager.sweep()).sort()).toEqual([DISK, LIVE]);
    await settle();
    expect(mcp.erd.manager.paths()).toEqual([]);
    expect(hub.documents.get(LIVE)!.peers.size).toBe(0);
  });

  it('counts from the last call, not the first', async () => {
    await mcp.ok('erd_add_table', { path: DISK });
    clock += IDLE_TTL_MS - 1;
    await mcp.text('erd_read', { path: DISK, format: 'snapshot' });

    clock += IDLE_TTL_MS - 1;
    expect(await mcp.erd.manager.sweep()).toEqual([]);
  });

  it('sweeps before each call, and a call after the sweep opens a working session', async () => {
    await mcp.ok('erd_add_table', { path: LIVE });
    clock += IDLE_TTL_MS;

    const memo = await mcp.ok('erd_add_memo', { path: LIVE });
    expect(memo.mode).toBe('live');
    expect(hub.webview(LIVE).state.doc.memoIds).toEqual(memo.createdIds);
    expect(hub.methods().filter(method => method === 'join')).toHaveLength(2);
    expect((await mcp.ok('erd_undo', { path: LIVE })).toolName).toBe(
      'erd_add_memo'
    );
    expect((await mcp.ok('erd_undo', { path: LIVE })).toolName).toBeNull();
  });
});
