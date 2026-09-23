import { afterEach, describe, expect, it } from 'vite-plus/test';

import { connectMcp, type McpHarness, RpcError } from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import { createSeededPeer, createSeedValue, SEED } from '@/__test-utils__/seed';
import { toDocumentList, toEntityDetails } from '@/tools/outline';

const DOCUMENT = '/work/seed.erd.json';

const harnesses: McpHarness[] = [];

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(mcp => mcp.close()));
});

/** A server over a disk holding the seed, with no VS Code window. */
async function connect() {
  const io = createMemoryHost();
  io.put(DOCUMENT, createSeedValue());
  const mcp = await connectMcp({ host: io });
  harnesses.push(mcp);
  return { io, mcp };
}

/** What a peer holding the seed file answers, for the server's answers to match. */
function fromSeed<T>(read: (peer: ReturnType<typeof createSeededPeer>) => T) {
  const peer = createSeededPeer();
  try {
    return read(peer);
  } finally {
    peer.destroy();
  }
}

/** A call's JSON-RPC error; fails the spec when the call was answered. */
const rpcError = async (
  mcp: McpHarness,
  name: string,
  args: Record<string, unknown>
) => {
  const error = await mcp.call(name, args).then(
    () => null,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(RpcError);
  return error as RpcError;
};

describe('erd_list', () => {
  it('answers the document list as compact JSON', async () => {
    const { mcp } = await connect();
    const text = await mcp.text('erd_list', { path: DOCUMENT });

    expect(text).toBe(
      JSON.stringify(fromSeed(peer => toDocumentList(peer.state)))
    );
  });

  it('refuses an argument it does not take with -32602', async () => {
    const { mcp } = await connect();
    const error = await rpcError(mcp, 'erd_list', {
      path: DOCUMENT,
      format: 'snapshot',
    });

    expect(error.code).toBe(-32602);
    expect(mcp.manager.paths()).toEqual([]);
  });
});

describe('erd_get', () => {
  it('answers the entities named, with the ids that name nothing', async () => {
    const { mcp } = await connect();
    const ids = {
      tableIds: [SEED.orders, 'gone'],
      relationshipIds: [SEED.relationship],
    };
    const text = await mcp.text('erd_get', { path: DOCUMENT, ...ids });

    expect(text).toBe(
      JSON.stringify(fromSeed(peer => toEntityDetails(peer.state, ids)))
    );
    expect(JSON.parse(text).missing).toEqual(['gone']);
  });

  it('refuses a call that names no id, before any session', async () => {
    const { mcp } = await connect();

    for (const args of [{}, { tableIds: [], memoIds: [] }]) {
      const refused = await mcp.call('erd_get', { path: DOCUMENT, ...args });
      expect(refused.isError).toBe(true);
      expect(refused.json).toEqual({
        error: {
          code: 'invalidArgs',
          message:
            'name at least one id in tableIds, relationshipIds, indexIds, memoIds; erd_list lists them',
        },
      });
    }
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('refuses ids of the wrong shape and keys it does not take with -32602', async () => {
    const { mcp } = await connect();

    for (const args of [
      { tableIds: SEED.users },
      { tableIds: [1] },
      { columnIds: [SEED.userId] },
    ]) {
      const error = await rpcError(mcp, 'erd_get', { path: DOCUMENT, ...args });
      expect(error.code, JSON.stringify(args)).toBe(-32602);
    }
    expect(mcp.manager.paths()).toEqual([]);
  });
});

describe('erd_move_tables', () => {
  const positions = [
    { tableId: SEED.users, x: 40, y: 60 },
    { tableId: SEED.empty, x: 700, y: 640 },
  ];

  const placed = async (mcp: McpHarness) =>
    JSON.parse(await mcp.text('erd_list', { path: DOCUMENT })).tables.map(
      ({ id, x, y }: { id: string; x: number; y: number }) => ({ id, x, y })
    );

  it('moves every table listed in one edit, which one erd_undo reverts', async () => {
    const { io, mcp } = await connect();
    const before = await placed(mcp);

    const moved = await mcp.ok('erd_move_tables', {
      path: DOCUMENT,
      positions,
    });
    expect(moved).toMatchObject({
      tool: 'erd_move_tables',
      mode: 'headless',
      createdIds: [],
      batches: 1,
      historyEntries: 1,
    });
    expect(await placed(mcp)).toEqual([
      { id: SEED.users, x: 40, y: 60 },
      { id: SEED.orders, x: 500, y: 100 },
      { id: SEED.empty, x: 700, y: 640 },
    ]);
    const onDisk = JSON.parse(io.read(DOCUMENT)).collections.tableEntities;
    expect(onDisk[SEED.empty].ui).toMatchObject({ x: 700, y: 640 });

    const undone = await mcp.ok('erd_undo', { path: DOCUMENT });
    expect(undone).toMatchObject({ toolName: 'erd_move_tables', entries: 1 });
    expect(await placed(mcp)).toEqual(before);
  });

  it('refuses a list that names a table twice, leaving the document alone', async () => {
    const { io, mcp } = await connect();
    const onDisk = io.read(DOCUMENT);

    const refused = await mcp.call('erd_move_tables', {
      path: DOCUMENT,
      positions: [...positions, { tableId: SEED.users, x: 0, y: 0 }],
    });

    expect(refused.isError).toBe(true);
    expect(refused.json.error.code).toBe('invalidArgs');
    expect(io.read(DOCUMENT)).toBe(onDisk);
  });

  it('refuses an entry of the wrong shape with -32602', async () => {
    const { mcp } = await connect();

    for (const entry of [
      { tableId: SEED.users, x: 'left', y: 0 },
      { tableId: SEED.users, x: 0 },
      { tableId: SEED.users, x: 0, y: 0, z: 1 },
    ]) {
      const error = await rpcError(mcp, 'erd_move_tables', {
        path: DOCUMENT,
        positions: [entry],
      });
      expect(error.code, JSON.stringify(entry)).toBe(-32602);
    }
    expect(mcp.manager.paths()).toEqual([]);
  });
});
