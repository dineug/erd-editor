import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { createMemoryIo, type MemoryIo } from '@/__test-utils__/memoryIo';
import { IDLE_TTL_MS } from '@/session/manager';

const A = '/work/a.erd.json';
const B = '/work/b.erd.json';

let io: MemoryIo;
let mcp: McpHarness;
let clock: number;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  clock = 0;
  io = createMemoryIo();
  io.put(A, emptyDocument());
  io.put(B, emptyDocument());
  mcp = await connectMcp({ io, now: () => clock });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

describe('the session manager', () => {
  it('runs parallel calls on one document one at a time', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => mcp.call('erd_add_table', { path: A }))
    );

    expect(results.every(({ isError }) => !isError)).toBe(true);
    expect(JSON.parse(io.read(A)).doc.tableIds).toHaveLength(4);
  });

  it('keeps running after a call on the same document failed', async () => {
    const [bad, good] = await Promise.all([
      mcp.call('erd_change_table_name', {
        path: A,
        tableId: 'none',
        value: 'x',
      }),
      mcp.call('erd_add_table', { path: A }),
    ]);

    expect(bad.json.error.code).toBe('notFound');
    expect(good.isError).toBe(false);
  });

  it('never sweeps a document while a call on it runs', async () => {
    await mcp.ok('erd_add_table', { path: A });
    // Short of the limit, so the sweep the call itself starts with keeps A.
    clock += IDLE_TTL_MS - 1;

    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const stat = io.stat;
    let held = false;
    io.stat = async path => {
      if (path === A && !held) {
        held = true;
        await gate;
      }
      return stat(path);
    };

    const slow = mcp.call('erd_add_memo', { path: A });
    await settle();
    expect(held).toBe(true);
    clock += 2;
    expect(await mcp.erd.manager.sweep()).toEqual([]);
    release();

    expect((await slow).isError).toBe(false);
    expect(mcp.erd.manager.paths()).toEqual([A]);
  });

  it('closes every session on closeAll', async () => {
    await mcp.ok('erd_add_table', { path: A });
    await mcp.ok('erd_add_table', { path: B });

    await mcp.erd.manager.closeAll();
    expect(mcp.erd.manager.paths()).toEqual([]);
  });
});
