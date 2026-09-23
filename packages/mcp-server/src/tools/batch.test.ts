import {
  type PeerStore,
  PeerStoreError,
  RelationshipType,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import {
  BATCH_TOOL,
  BatchInterrupted,
  MAX_OPERATIONS,
  runBatch,
} from '@/tools/batch';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { toAgentSnapshot } from '@/tools/snapshot';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

const seeded = () => {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
};

function refusal(run: () => unknown): ToolError {
  try {
    run();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the batch was accepted');
}

/** A reviews table with a key, linked from users: every id a later step needs is named. */
const REVIEWS = [
  { tool: 'erd_add_table', as: 'reviews' },
  {
    tool: 'erd_change_table_name',
    args: { tableId: '$reviews', value: 'reviews' },
  },
  { tool: 'erd_add_column', as: 'id', args: { tableId: '$reviews' } },
  {
    tool: 'erd_change_column_name',
    args: { tableId: '$reviews', columnId: '$id', value: 'id' },
  },
  {
    tool: 'erd_set_column_primary_key',
    args: { tableId: '$reviews', columnId: '$id', value: true },
  },
  {
    tool: 'erd_add_relationship',
    as: 'byUser',
    args: {
      startTableId: SEED.users,
      endTableId: '$reviews',
      relationshipType: 'ZeroN',
    },
  },
];

const tableNamed = (peer: PeerStore, name: string) =>
  toAgentSnapshot(peer.state).tables.find(table => table.name === name);

describe('a batch of edit tools', () => {
  it('runs every operation in order, each $name standing for the ids an earlier one created', () => {
    const peer = seeded();

    const run = runBatch(peer, REVIEWS);

    const reviews = tableNamed(peer, 'reviews')!;
    expect(reviews.id).toBe(run.steps[0].createdIds[0]);
    expect(reviews.columns[0]).toMatchObject({
      id: run.steps[2].createdIds[0],
      name: 'id',
      primaryKey: true,
    });
    // The relationship brings users' key into reviews as a column of its own.
    expect(reviews.columns).toHaveLength(2);
    expect(run.steps.map(({ tool, as }) => [tool, as])).toEqual(
      REVIEWS.map(({ tool, as }) => [tool, as])
    );
    expect(run.createdIds).toEqual(run.steps.flatMap(step => step.createdIds));
    expect(run).toMatchObject({ tool: BATCH_TOOL, withoutUndo: [] });
    expect(run.historyEntries).toBeGreaterThanOrEqual(REVIEWS.length);
  });

  it('is one undo unit, which one undo reverts and one redo puts back', () => {
    const peer = seeded();
    const before = toAgentSnapshot(peer.state);

    const run = runBatch(peer, REVIEWS);

    expect(peer.undo()).toEqual({
      label: BATCH_TOOL,
      entries: run.historyEntries,
      skipped: [],
    });
    expect(toAgentSnapshot(peer.state)).toEqual(before);
    expect(peer.redo().label).toBe(BATCH_TOOL);
    expect(tableNamed(peer, 'reviews')).toBeDefined();
  });

  it('picks a later id of an operation by $name.n', () => {
    const peer = seeded();

    const run = runBatch(peer, [
      ...REVIEWS,
      {
        tool: 'erd_change_relationship_type',
        args: { relationshipId: '$byUser.1', relationshipType: 'OneOnly' },
      },
    ]);

    const relationshipId = run.steps[5].createdIds[1];
    expect(
      peer.state.collections.relationshipEntities[relationshipId]
        .relationshipType
    ).toBe(RelationshipType.OneOnly);
  });

  it('picks the last id of an operation by $name.last', () => {
    const peer = seeded();

    const run = runBatch(peer, [
      ...REVIEWS,
      {
        tool: 'erd_change_relationship_type',
        args: { relationshipId: '$byUser.last', relationshipType: 'OneN' },
      },
    ]);

    const [relationshipId] = run.steps[5].createdIds.slice(-1);
    expect(
      peer.state.collections.relationshipEntities[relationshipId]
        .relationshipType
    ).toBe(RelationshipType.OneN);
    expect(
      refusal(() =>
        runBatch(peer, [
          {
            tool: 'erd_change_table_name',
            as: 'n',
            args: { tableId: SEED.users, value: 'x' },
          },
          { tool: 'erd_remove_table', args: { tableId: '$n.last' } },
        ])
      ).message
    ).toBe(
      'operations[1] erd_remove_table: tableId $n.last asks for id last, but n created 0'
    );
  });

  it('resolves references inside id lists and table positions', () => {
    const peer = seeded();

    runBatch(peer, [
      ...REVIEWS,
      { tool: 'erd_add_column', as: 'extra', args: { tableId: '$reviews' } },
      {
        tool: 'erd_move_tables',
        args: { positions: [{ tableId: '$reviews', x: 1200, y: 40 }] },
      },
      {
        tool: 'erd_remove_columns',
        args: { tableId: '$reviews', columnIds: ['$extra'] },
      },
    ]);

    expect(tableNamed(peer, 'reviews')).toMatchObject({ x: 1200, y: 40 });
    expect(tableNamed(peer, 'reviews')!.columns).toHaveLength(2);
  });

  it('takes a value that looks like a reference as the value it is', () => {
    const peer = seeded();

    runBatch(peer, [
      { tool: 'erd_add_table', as: 't' },
      {
        tool: 'erd_change_table_comment',
        args: { tableId: '$t', value: '$t' },
      },
    ]);

    expect(toAgentSnapshot(peer.state).tables.at(-1)!.comment).toBe('$t');
  });

  it('lists the operations the editor keeps no undo entry for', () => {
    const peer = seeded();

    const run = runBatch(peer, [
      { tool: 'erd_set_database', args: { value: 'PostgreSQL' } },
      { tool: 'erd_add_table' },
    ]);

    expect(run.withoutUndo).toEqual([0]);
    expect(peer.undo()).toMatchObject({ label: BATCH_TOOL, entries: 1 });
  });
});

describe('a batch runs all of its operations or none', () => {
  it('refuses an operation the document turns down, naming it, and leaves the document alone', () => {
    const peer = seeded();
    const before = peer.value;

    const error = refusal(() =>
      runBatch(peer, [
        ...REVIEWS,
        {
          tool: 'erd_change_column_name',
          args: { tableId: SEED.users, columnId: 'gone', value: 'x' },
        },
      ])
    );

    expect(error).toMatchObject({
      code: ToolErrorCode.notFound,
      tool: BATCH_TOOL,
    });
    expect(error.message).toMatch(
      /^operations\[6\] erd_change_column_name: columnId gone names no live column/
    );
    expect(peer.value).toBe(before);
    expect(peer.undo()).toEqual({ label: null, entries: 0, skipped: [] });
  });

  it('refuses a reference no earlier operation names, or an id it did not create', () => {
    const peer = seeded();

    expect(
      refusal(() =>
        runBatch(peer, [
          {
            tool: 'erd_change_table_name',
            args: { tableId: '$t', value: 'x' },
          },
        ])
      ).message
    ).toBe(
      'operations[0] erd_change_table_name: tableId $t names no earlier operation; name it with as'
    );
    expect(
      refusal(() =>
        runBatch(peer, [
          { tool: 'erd_add_table', as: 't' },
          {
            tool: 'erd_change_table_name',
            args: { tableId: '$t.3', value: 'x' },
          },
        ])
      ).message
    ).toBe(
      'operations[1] erd_change_table_name: tableId $t.3 asks for id 3, but t created 1'
    );
    // A reference to a later operation is no reference yet.
    expect(
      refusal(() =>
        runBatch(peer, [
          {
            tool: 'erd_change_table_name',
            args: { tableId: '$t', value: 'x' },
          },
          { tool: 'erd_add_table', as: 't' },
        ])
      ).code
    ).toBe(ToolErrorCode.invalidArgs);
    expect(toAgentSnapshot(peer.state).tables).toHaveLength(3);
  });

  it('refuses a malformed list before running anything', () => {
    const peer = seeded();
    const cases: Array<[unknown, string]> = [
      [[], 'operations must be a non-empty list'],
      ['erd_add_table', 'operations must be a non-empty list'],
      [
        Array.from({ length: MAX_OPERATIONS + 1 }, () => ({
          tool: 'erd_add_table',
        })),
        `operations holds ${MAX_OPERATIONS + 1} entries; one call takes at most ${MAX_OPERATIONS}`,
      ],
      [[null], 'operations[0] must be an object'],
      [
        [{ tool: 'erd_save' }],
        'operations[0].tool erd_save is no edit tool; a batch runs the erd_ edit tools only',
      ],
      [
        [{ tool: 'erd_add_table', as: 'a b' }],
        'operations[0].as must be a name of letters, digits and underscores',
      ],
      [
        [
          { tool: 'erd_add_table', as: 't' },
          { tool: 'erd_add_table', as: 't' },
        ],
        'operations[1].as t is used twice',
      ],
      [
        [{ tool: 'erd_add_table', args: [] }],
        'operations[0].args must be an object',
      ],
    ];

    for (const [operations, message] of cases) {
      const error = refusal(() => runBatch(peer, operations));
      expect(error.message).toBe(message);
      expect(error.code).toBe(ToolErrorCode.invalidArgs);
    }
    expect(toAgentSnapshot(peer.state).tables).toHaveLength(3);
  });

  it('refuses an argument an operation does not take, as the tool would', () => {
    const peer = seeded();

    expect(
      refusal(() =>
        runBatch(peer, [{ tool: 'erd_add_table', args: { bogus: 1 } }])
      ).message
    ).toBe(
      'operations[0] erd_add_table: unexpected argument bogus; accepted: none'
    );
  });

  it('reports a failure on the peer after the rehearsal passed as an interrupted batch', () => {
    const peer = seeded();
    // Everything but dispatch is the peer's own, so only the real run fails.
    const failing = Object.create(peer, {
      dispatch: {
        value: () => {
          throw new Error('boom');
        },
      },
      group: { value: peer.group },
    });

    expect(() => runBatch(failing, REVIEWS)).toThrow(BatchInterrupted);
    expect(() => runBatch(failing, REVIEWS)).toThrow(
      /stopped part way on the document after its rehearsal passed, so nothing of it was kept: boom$/
    );
  });

  it('refuses on a readonly or destroyed peer', () => {
    const peer = seeded();
    peer.setReadonly(true);

    expect(() => runBatch(peer, REVIEWS)).toThrow(PeerStoreError);
    peer.setReadonly(false);
    peer.destroy();
    expect(() => runBatch(peer, REVIEWS)).toThrow(
      expect.objectContaining({ code: 'destroyed', operation: BATCH_TOOL })
    );
  });
});
