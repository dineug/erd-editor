// @vitest-environment node

import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { toolByName } from '@/agent/registry';
import { defaultToWidth } from '@/agent/toWidth';
import { validateToolArgs } from '@/agent/validate';
import { ColumnOption, RelationshipType } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { bHas } from '@/utils/bit';

const context = createEngineContext({ toWidth: defaultToWidth });
const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  peers.push(peer);
  peer.setInitialValue(createSeedValue());
  return peer;
}

const relate = (peer: AgentPeer, startTableId: string, endTableId: string) =>
  peer.runTool('erd_add_relationship', {
    startTableId,
    endTableId,
    relationshipType: 'OneN',
  });

const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('the call was accepted');
    },
    (error: unknown) => error as AgentToolError
  );

describe('erd_add_relationship relates two tables in one call (AC-E9′, AC-E7)', () => {
  it('copies an existing key: one batch, one entry, the new column and relationship ids back', async () => {
    const peer = seededPeer();
    const ordersColumns = [
      ...peer.state.collections.tableEntities[SEED.orders].columnIds,
    ];

    const run = await relate(peer, SEED.users, SEED.orders);

    const { collections, doc } = peer.state;
    const [foreignKeyId, relationshipId] = run.createdIds;
    const relationship = collections.relationshipEntities[relationshipId];
    const foreignKey = collections.tableColumnEntities[foreignKeyId];

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(run.mismatch).toBeUndefined();
    expect(run.createdIds).toHaveLength(2);
    expect(doc.relationshipIds).toContain(relationshipId);
    expect(collections.tableEntities[SEED.orders].columnIds).toEqual([
      ...ordersColumns,
      foreignKeyId,
    ]);
    expect(relationship).toMatchObject({
      relationshipType: RelationshipType.OneN,
      start: { tableId: SEED.users, columnIds: [SEED.userId] },
      end: { tableId: SEED.orders, columnIds: [foreignKeyId] },
    });
    expect(foreignKey).toMatchObject({ name: 'id', dataType: 'INT' });
    expect(bHas(foreignKey.options, ColumnOption.notNull)).toBe(true);
  });

  it('gives a start table without a key one first, in the same batch and entry', async () => {
    const peer = seededPeer();

    const run = await relate(peer, SEED.empty, SEED.users);

    const { collections } = peer.state;
    const [primaryKeyId, foreignKeyId, relationshipId] = run.createdIds;

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(run.mismatch).toBeUndefined();
    expect(run.createdIds).toHaveLength(3);
    expect(collections.tableEntities[SEED.empty].columnIds).toEqual([
      primaryKeyId,
    ]);
    expect(
      bHas(
        collections.tableColumnEntities[primaryKeyId].options,
        ColumnOption.primaryKey
      )
    ).toBe(true);
    expect(collections.relationshipEntities[relationshipId]).toMatchObject({
      start: { tableId: SEED.empty, columnIds: [primaryKeyId] },
      end: { tableId: SEED.users, columnIds: [foreignKeyId] },
    });
  });

  it('never touches the relationship draw a pointer would use', async () => {
    const peer = seededPeer();
    const tool = toolByName.get('erd_add_relationship')!;
    // Everything the call dispatches, not only the part the shared store sends.
    const emitted = (startTableId: string, endTableId: string) =>
      compositionActionsFlat(peer.state, context, [
        ...tool.toActions(
          validateToolArgs(
            tool,
            { startTableId, endTableId, relationshipType: 'OneN' },
            peer.state
          )
        ),
      ]).map(({ type }) => type);

    for (const [startTableId, endTableId] of [
      [SEED.empty, SEED.users],
      [SEED.users, SEED.orders],
    ]) {
      const types = emitted(startTableId, endTableId);

      expect(types).toContain('relationship.add');
      expect(types.filter(type => type.startsWith('editor.'))).toEqual([]);
      await relate(peer, startTableId, endTableId);
      expect(peer.state.editor.drawRelationship).toBeNull();
    }
  });

  it('relates a table to itself', async () => {
    const peer = seededPeer();

    const run = await relate(peer, SEED.users, SEED.users);
    const [foreignKeyId, relationshipId] = run.createdIds;

    expect(
      peer.state.collections.relationshipEntities[relationshipId]
    ).toMatchObject({
      start: { tableId: SEED.users, columnIds: [SEED.userId] },
      end: { tableId: SEED.users, columnIds: [foreignKeyId] },
    });
  });

  it('takes the whole call back with one undo', async () => {
    const peer = seededPeer();
    const before = peer.read('snapshot');

    await relate(peer, SEED.empty, SEED.users);
    expect(peer.read('snapshot')).not.toBe(before);
    const result = await peer.undo();

    expect(result).toEqual({
      toolName: 'erd_add_relationship',
      entries: 1,
      skipped: [],
    });
    expect(peer.read('snapshot')).toBe(before);
  });

  it('refuses a removed table and an unknown relationship type', async () => {
    const peer = seededPeer();
    await peer.runTool('erd_remove_table', { tableId: SEED.empty });

    const gone = await refusal(relate(peer, SEED.empty, SEED.users));
    const badType = await refusal(
      peer.runTool('erd_add_relationship', {
        startTableId: SEED.users,
        endTableId: SEED.orders,
        relationshipType: 'Many',
      })
    );

    expect(gone.code).toBe(AgentToolErrorCode.notFound);
    expect(badType.code).toBe(AgentToolErrorCode.invalidArgs);
    expect(badType.message).toBe(
      'relationshipType must be one of ZeroOne, ZeroN, OneOnly, OneN'
    );
  });
});

describe('erd_link_columns relates columns that already exist', () => {
  it('adds one relationship over the named columns and returns its id', async () => {
    const peer = seededPeer();
    const columns = peer.state.collections.tableColumnEntities;
    const columnCount = Object.keys(columns).length;

    const run = await peer.runTool('erd_link_columns', {
      startTableId: SEED.users,
      startColumnIds: [SEED.userId],
      endTableId: SEED.orders,
      endColumnIds: [SEED.orderNote],
      relationshipType: 'ZeroOne',
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(run.actions.map(({ type }) => type)).toEqual(['relationship.add']);
    expect(Object.keys(columns)).toHaveLength(columnCount);
    expect(
      peer.state.collections.relationshipEntities[run.createdIds[0]]
    ).toMatchObject({
      relationshipType: RelationshipType.ZeroOne,
      start: { tableId: SEED.users, columnIds: [SEED.userId] },
      end: { tableId: SEED.orders, columnIds: [SEED.orderNote] },
    });
  });

  it('refuses columns that do not pair up, or that belong to another table', async () => {
    const peer = seededPeer();
    const base = {
      startTableId: SEED.users,
      endTableId: SEED.orders,
      relationshipType: 'OneN',
    };

    const unpaired = await refusal(
      peer.runTool('erd_link_columns', {
        ...base,
        startColumnIds: [SEED.userId],
        endColumnIds: [SEED.orderUser, SEED.orderNote],
      })
    );
    const elsewhere = await refusal(
      peer.runTool('erd_link_columns', {
        ...base,
        startColumnIds: [SEED.orderId],
        endColumnIds: [SEED.orderNote],
      })
    );

    expect(unpaired.code).toBe(AgentToolErrorCode.invalidArgs);
    expect(unpaired.message).toContain('must pair up');
    expect(elsewhere.code).toBe(AgentToolErrorCode.notFound);
    expect(elsewhere.message).toContain('in startTableId users');
    expect(peer.state.doc.relationshipIds).toEqual([SEED.relationship]);
  });
});
