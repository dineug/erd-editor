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
