import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { connectMcp, type McpHarness, RpcError } from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import { createSeedValue, SEED } from '@/__test-utils__/seed';
import { BatchInterrupted, runBatch } from '@/tools/batch';
import { NO_ENTRY_NOTE, UNCHANGED_NOTE } from '@/tools/result';
import { runTool } from '@/tools/run';

vi.mock('@/tools/batch', async importOriginal => {
  const actual = await importOriginal<typeof import('@/tools/batch')>();
  return { ...actual, runBatch: vi.fn(actual.runBatch) };
});

const DOCUMENT = '/work/seed.erd.json';

const harnesses: McpHarness[] = [];

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map(mcp => mcp.close()));
});

async function connect() {
  const io = createMemoryHost();
  io.put(DOCUMENT, createSeedValue());
  const mcp = await connectMcp({ host: io });
  harnesses.push(mcp);
  return { io, mcp };
}

const REVIEWS = [
  { tool: 'erd_add_table', as: 'reviews' },
  {
    tool: 'erd_change_table_name',
    args: { tableId: '$reviews', value: 'reviews' },
  },
  { tool: 'erd_add_column', as: 'rating', args: { tableId: '$reviews' } },
  {
    tool: 'erd_change_column_name',
    args: { tableId: '$reviews', columnId: '$rating', value: 'rating' },
  },
  {
    tool: 'erd_change_column_data_type',
    args: { tableId: '$reviews', columnId: '$rating', value: 'INT' },
  },
];

const tableNames = async (mcp: McpHarness) =>
  JSON.parse(await mcp.text('erd_list', { path: DOCUMENT })).tables.map(
    ({ name }: { name: string }) => name
  );

describe('erd_batch', () => {
  it('builds a table with its column in one call and writes the file once', async () => {
    const { io, mcp } = await connect();

    const result = await mcp.ok('erd_batch', {
      path: DOCUMENT,
      operations: REVIEWS,
    });

    expect(result).toMatchObject({
      tool: 'erd_batch',
      mode: 'headless',
      operations: [
        { tool: 'erd_add_table', as: 'reviews' },
        { tool: 'erd_change_table_name', createdIds: [] },
        { tool: 'erd_add_column', as: 'rating' },
        { tool: 'erd_change_column_name' },
        { tool: 'erd_change_column_data_type' },
      ],
      historyEntries: 5,
    });
    expect(result.createdIds).toHaveLength(2);
    // Five entries, and the result says they are one erd_undo, not five.
    expect(result.undoNote).toBe(
      'One erd_undo reverts this whole batch. historyEntries counts the editor history entries inside the batch, not erd_undo calls.'
    );
    expect(result).not.toHaveProperty('undoable');
    const onDisk = JSON.parse(io.read(DOCUMENT));
    const reviews = onDisk.collections.tableEntities[result.createdIds[0]];
    expect(reviews.name).toBe('reviews');
    expect(
      onDisk.collections.tableColumnEntities[result.createdIds[1]]
    ).toMatchObject({ name: 'rating', dataType: 'INT' });
  });

  it('is reverted whole by one erd_undo', async () => {
    const { io, mcp } = await connect();
    const onDisk = io.read(DOCUMENT);
    await mcp.ok('erd_batch', { path: DOCUMENT, operations: REVIEWS });

    expect(await mcp.ok('erd_undo', { path: DOCUMENT })).toMatchObject({
      toolName: 'erd_batch',
      entries: 5,
    });
    expect(await tableNames(mcp)).toEqual(['users', 'orders', 'empty']);
    expect(JSON.parse(io.read(DOCUMENT)).doc).toEqual(JSON.parse(onDisk).doc);
  });

  it('refuses the whole batch for one refused operation, leaving the file as it was', async () => {
    const { io, mcp } = await connect();
    const onDisk = io.read(DOCUMENT);

    const refused = await mcp.call('erd_batch', {
      path: DOCUMENT,
      operations: [
        ...REVIEWS,
        { tool: 'erd_remove_table', args: { tableId: 'gone' } },
      ],
    });

    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'notFound',
      message:
        'operations[5] erd_remove_table: tableId gone names no live table; read the document for current ids',
    });
    expect(io.read(DOCUMENT)).toBe(onDisk);
    expect(await tableNames(mcp)).toEqual(['users', 'orders', 'empty']);
  });

  it('says which operations one erd_undo leaves in place', async () => {
    const { mcp } = await connect();

    const result = await mcp.ok('erd_batch', {
      path: DOCUMENT,
      operations: [
        { tool: 'erd_set_database', args: { value: 'PostgreSQL' } },
        {
          tool: 'erd_change_table_name',
          args: { tableId: SEED.empty, value: 'drafts' },
        },
      ],
    });

    expect(result.undoNote).toBe(
      'One erd_undo reverts this batch, except operations[0] erd_set_database: the editor keeps no undo entry for those. historyEntries counts the editor history entries inside the batch, not erd_undo calls.'
    );
    expect(result).not.toHaveProperty('undoable');
  });

  it('says when one erd_undo has nothing of the batch to revert', async () => {
    const { mcp } = await connect();
    const settings = [
      { tool: 'erd_set_database', args: { value: 'PostgreSQL' } },
    ];

    expect(
      await mcp.ok('erd_batch', { path: DOCUMENT, operations: settings })
    ).toMatchObject({
      historyEntries: 0,
      undoable: false,
      undoNote: NO_ENTRY_NOTE,
    });
    // The seed's key column is already not null, so the flag sends nothing.
    expect(
      await mcp.ok('erd_batch', {
        path: DOCUMENT,
        operations: [
          {
            tool: 'erd_set_column_not_null',
            args: { tableId: SEED.users, columnId: SEED.userId, value: true },
          },
        ],
      })
    ).toMatchObject({
      batches: 0,
      undoable: false,
      undoNote: UNCHANGED_NOTE,
    });
  });

  it('keeps nothing of a batch cut short on the peer: the file stays and the next read loads it', async () => {
    const { io, mcp } = await connect();
    const onDisk = io.read(DOCUMENT);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(runBatch).mockImplementationOnce(peer => {
      runTool(peer, 'erd_add_table', {});
      throw new BatchInterrupted(new Error('boom'));
    });

    const refused = await mcp.call('erd_batch', {
      path: DOCUMENT,
      operations: [{ tool: 'erd_add_table' }],
    });

    expect(refused.isError).toBe(true);
    expect(refused.json.error.message).toMatch(
      /^erd_batch stopped part way on the document after its rehearsal passed, so nothing of it was kept: boom/
    );
    expect(io.read(DOCUMENT)).toBe(onDisk);
    expect(await tableNames(mcp)).toEqual(['users', 'orders', 'empty']);
    vi.restoreAllMocks();
  });

  it('refuses an empty list, a list over the limit and a malformed as with -32602', async () => {
    const { mcp } = await connect();

    for (const operations of [
      [],
      Array.from({ length: 101 }, () => ({ tool: 'erd_add_table' })),
      [{ tool: 'erd_add_table', as: 'a b' }],
    ]) {
      const error = await mcp
        .call('erd_batch', { path: DOCUMENT, operations })
        .then(
          () => null,
          (reason: unknown) => reason
        );
      expect((error as RpcError).code).toBe(-32602);
    }
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('refuses an unknown key or tool in an operation with -32602, before any session', async () => {
    const { mcp } = await connect();

    for (const operation of [
      { tool: 'erd_add_table', bogus: 1 },
      { tool: 'erd_save' },
      { as: 't' },
    ]) {
      const error = await mcp
        .call('erd_batch', { path: DOCUMENT, operations: [operation] })
        .then(
          () => null,
          (reason: unknown) => reason
        );
      expect(error, JSON.stringify(operation)).toBeInstanceOf(RpcError);
      expect((error as RpcError).code).toBe(-32602);
    }
    expect(mcp.manager.paths()).toEqual([]);
  });
});
