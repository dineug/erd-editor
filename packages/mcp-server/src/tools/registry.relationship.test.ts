import {
  bHas,
  ColumnOption,
  createEngineContext,
  defaultToWidth,
  type PeerStore,
  RelationshipType,
} from '@dineug/erd-editor/peer.js';
import { compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { readDocument } from '@/tools/read';
import { toolByName } from '@/tools/registry';
import { runTool } from '@/tools/run';
import { validateToolArgs } from '@/tools/validate';

const context = createEngineContext({ toWidth: defaultToWidth });
const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
}

const relate = (peer: PeerStore, startTableId: string, endTableId: string) =>
  runTool(peer, 'erd_add_relationship', {
    startTableId,
    endTableId,
    relationshipType: 'OneN',
  });

function refusal(call: () => unknown): ToolError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the call was accepted');
}

describe('erd_add_relationship relates two tables in one call (AC-E9′, AC-E7)', () => {
  it('copies an existing key: one batch, one entry, the new column and relationship ids back', () => {
    const peer = seededPeer();
    const ordersColumns = [
      ...peer.state.collections.tableEntities[SEED.orders].columnIds,
    ];

    const run = relate(peer, SEED.users, SEED.orders);

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

  it('gives a start table without a key one first, in the same batch and entry', () => {
    const peer = seededPeer();

    const run = relate(peer, SEED.empty, SEED.users);

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

  it('never touches the relationship draw a pointer would use', () => {
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
      relate(peer, startTableId, endTableId);
      expect(peer.state.editor.drawRelationship).toBeNull();
    }
  });

  it('relates a table to itself', () => {
    const peer = seededPeer();

    const run = relate(peer, SEED.users, SEED.users);
    const [foreignKeyId, relationshipId] = run.createdIds;

    expect(
      peer.state.collections.relationshipEntities[relationshipId]
    ).toMatchObject({
      start: { tableId: SEED.users, columnIds: [SEED.userId] },
      end: { tableId: SEED.users, columnIds: [foreignKeyId] },
    });
  });

  it('takes the whole call back with one undo', () => {
    const peer = seededPeer();
    const before = readDocument(peer.state, 'snapshot');

    relate(peer, SEED.empty, SEED.users);
    expect(readDocument(peer.state, 'snapshot')).not.toBe(before);
    const result = peer.undo();

    expect(result).toEqual({
      label: 'erd_add_relationship',
      entries: 1,
      skipped: [],
    });
    expect(readDocument(peer.state, 'snapshot')).toBe(before);
  });

  it('refuses a removed table and an unknown relationship type', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_remove_table', { tableId: SEED.empty });

    const gone = refusal(() => relate(peer, SEED.empty, SEED.users));
    const badType = refusal(() =>
      runTool(peer, 'erd_add_relationship', {
        startTableId: SEED.users,
        endTableId: SEED.orders,
        relationshipType: 'Many',
      })
    );

    expect(gone.code).toBe(ToolErrorCode.notFound);
    expect(badType.code).toBe(ToolErrorCode.invalidArgs);
    expect(badType.message).toBe(
      'relationshipType must be one of ZeroOne, ZeroN, OneOnly, OneN'
    );
  });
});

describe('erd_link_columns relates columns that already exist', () => {
  it('adds one relationship over the named columns and returns its id', () => {
    const peer = seededPeer();
    const columns = peer.state.collections.tableColumnEntities;
    const columnCount = Object.keys(columns).length;

    const run = runTool(peer, 'erd_link_columns', {
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

  it('refuses columns that do not pair up, or that belong to another table', () => {
    const peer = seededPeer();
    const base = {
      startTableId: SEED.users,
      endTableId: SEED.orders,
      relationshipType: 'OneN',
    };

    const unpaired = refusal(() =>
      runTool(peer, 'erd_link_columns', {
        ...base,
        startColumnIds: [SEED.userId],
        endColumnIds: [SEED.orderUser, SEED.orderNote],
      })
    );
    const elsewhere = refusal(() =>
      runTool(peer, 'erd_link_columns', {
        ...base,
        startColumnIds: [SEED.orderId],
        endColumnIds: [SEED.orderNote],
      })
    );

    expect(unpaired.code).toBe(ToolErrorCode.invalidArgs);
    expect(unpaired.message).toBe(
      'startColumnIds and endColumnIds must pair up, one end column for each start column'
    );
    expect(elsewhere.code).toBe(ToolErrorCode.notFound);
    expect(elsewhere.message).toContain('in startTableId users');
    expect(peer.state.doc.relationshipIds).toEqual([SEED.relationship]);
  });
});
