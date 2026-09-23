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
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { IDLE_TTL_MS, SWEEP_INTERVAL_MS } from '@/session/manager';

const LIVE = '/work/live.erd.json';
const DISK = '/disk/solo.erd.json';

/** Half an interval, so no timed sweep lands on the instant a spec sweeps at. */
const OFF_BEAT = SWEEP_INTERVAL_MS / 2;

let io: MemoryHost;
let hub: FakeHub;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(LIVE, emptyDocument());
  io.put(DISK, emptyDocument());
  hub = createFakeHub(io, { pid: 3434, workspaceFolders: ['/work'] });
  mcp = await connectMcp({ host: io, testClock: true });
  await mcp.adjust(OFF_BEAT);
});

afterEach(async () => {
  await mcp.close();
  hub.destroy();
  vi.restoreAllMocks();
});

describe('idle sessions (AC-P15)', () => {
  it('is thirty minutes, looked for every minute', () => {
    expect(IDLE_TTL_MS).toBe(30 * 60 * 1000);
    expect(SWEEP_INTERVAL_MS).toBe(60_000);
  });

  it('closes a session idle for the whole period, live and headless alike', async () => {
    await mcp.ok('erd_add_table', { path: LIVE });
    await mcp.ok('erd_add_table', { path: DISK });
    expect(mcp.manager.paths().sort()).toEqual([DISK, LIVE]);

    await mcp.adjust(IDLE_TTL_MS - 1);
    expect(await mcp.manager.sweep()).toEqual([]);

    await mcp.adjust(1);
    expect((await mcp.manager.sweep()).sort()).toEqual([DISK, LIVE]);
    expect(mcp.manager.paths()).toEqual([]);
    expect(hub.documents.get(LIVE)!.peers.size).toBe(0);
  });

  it('closes it on the timed sweep between calls too', async () => {
    await mcp.ok('erd_add_table', { path: LIVE });

    await mcp.adjust(IDLE_TTL_MS + OFF_BEAT - 1);
    expect(mcp.manager.paths()).toEqual([LIVE]);

    await mcp.adjust(1);
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('counts from the last call, not the first', async () => {
    await mcp.ok('erd_add_table', { path: DISK });
    await mcp.adjust(IDLE_TTL_MS - 1);
    await mcp.text('erd_read', { path: DISK, format: 'snapshot' });

    await mcp.adjust(IDLE_TTL_MS - 1);
    expect(await mcp.manager.sweep()).toEqual([]);
    expect(mcp.manager.paths()).toEqual([DISK]);
  });

  it('sweeps before each call, and a call after the sweep opens a working session', async () => {
    await mcp.ok('erd_add_table', { path: LIVE });
    await mcp.adjust(IDLE_TTL_MS);

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
