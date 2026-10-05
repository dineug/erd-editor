import {
  bHas,
  ColumnOption,
  createEngineContext,
  defaultToWidth,
  type PeerStore,
  ReferentialAction,
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

const columnNames = (peer: PeerStore, columnIds: string[]) =>
  columnIds.map(id => peer.state.collections.tableColumnEntities[id].name);

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
    expect(foreignKey).toMatchObject({ name: 'users_id', dataType: 'INT' });
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

  it('relates a table to itself, the foreign key named apart from its key', () => {
    const peer = seededPeer();

    const run = relate(peer, SEED.users, SEED.users);
    const [foreignKeyId, relationshipId] = run.createdIds;

    expect(
      peer.state.collections.relationshipEntities[relationshipId]
    ).toMatchObject({
      start: { tableId: SEED.users, columnIds: [SEED.userId] },
      end: { tableId: SEED.users, columnIds: [foreignKeyId] },
    });
    expect(peer.state.collections.tableColumnEntities[foreignKeyId].name).toBe(
      'users_id'
    );
  });

  it('numbers the foreign key of a second relationship into one child', () => {
    const peer = seededPeer();

    const [first] = relate(peer, SEED.users, SEED.orders).createdIds;
    const [second] = relate(peer, SEED.users, SEED.orders).createdIds;

    expect(columnNames(peer, [first, second])).toEqual([
      'users_id',
      'users_id_2',
    ]);
  });

  it('keeps a key name of several words, numbered only for a name the child has', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userId,
      value: 'user_id',
    });

    const [intoEmpty] = relate(peer, SEED.users, SEED.empty).createdIds;
    const [intoOrders] = relate(peer, SEED.users, SEED.orders).createdIds;

    expect(columnNames(peer, [intoEmpty, intoOrders])).toEqual([
      'user_id',
      'user_id_2',
    ]);
  });

  it('keeps a key name where Hangul meets Latin and prefixes one of Hangul alone', () => {
    const peer = seededPeer();
    const renameKey = (value: string) =>
      runTool(peer, 'erd_change_column_name', {
        tableId: SEED.users,
        columnId: SEED.userId,
        value,
      });

    renameKey('회원ID');
    const [mixed] = relate(peer, SEED.users, SEED.empty).createdIds;
    renameKey('번호');
    const [hangul] = relate(peer, SEED.users, SEED.empty).createdIds;

    expect(columnNames(peer, [mixed, hangul])).toEqual([
      '회원ID',
      'users_번호',
    ]);
  });

  it('names after an unnamed parent the key alone and keeps the names through a later rename', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_change_table_name', { tableId: SEED.users, value: '' });

    const [intoEmpty] = relate(peer, SEED.users, SEED.empty).createdIds;
    const [intoItself] = relate(peer, SEED.users, SEED.users).createdIds;
    runTool(peer, 'erd_change_table_name', {
      tableId: SEED.users,
      value: 'members',
    });

    expect(columnNames(peer, [intoEmpty, intoItself])).toEqual(['id', 'id_2']);
  });

  it('leaves the foreign key of a key it had to create unnamed, like that key', () => {
    const peer = seededPeer();

    const [primaryKeyId, foreignKeyId] = relate(
      peer,
      SEED.empty,
      SEED.users
    ).createdIds;

    expect(columnNames(peer, [primaryKeyId, foreignKeyId])).toEqual(['', '']);
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

describe('the create tools take the referential actions of the new relationship', () => {
  const link = {
    startTableId: SEED.users,
    startColumnIds: [SEED.userId],
    endTableId: SEED.orders,
    endColumnIds: [SEED.orderNote],
    relationshipType: 'OneN',
  };
  const add = {
    startTableId: SEED.users,
    endTableId: SEED.orders,
    relationshipType: 'OneN',
  };

  it.each([
    ['erd_add_relationship', add],
    ['erd_link_columns', link],
  ] as const)(
    '%s sets both in its one entry, the snapshot reading them back',
    (tool, args) => {
      const peer = seededPeer();

      const run = runTool(peer, tool, {
        ...args,
        onDelete: 'cascade',
        onUpdate: 'restrict',
      });
      const relationshipId = run.createdIds.at(-1)!;
      const { relationships } = JSON.parse(
        readDocument(peer.state, 'snapshot')
      );

      expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
      expect(
        relationships.find(({ id }: { id: string }) => id === relationshipId)
      ).toMatchObject({ onDelete: 'cascade', onUpdate: 'restrict' });
    }
  );

  it.each([
    ['erd_add_relationship', add],
    ['erd_link_columns', link],
  ] as const)(
    '%s leaves an action it is not given unset, off the action',
    (tool, args) => {
      const peer = seededPeer();

      const run = runTool(peer, tool, { ...args, onUpdate: 'setNull' });
      const added = run.actions.find(({ type }) => type === 'relationship.add');

      expect(added?.payload).not.toHaveProperty('onDelete');
      expect(
        peer.state.collections.relationshipEntities[run.createdIds.at(-1)!]
      ).toMatchObject({
        onDelete: ReferentialAction.none,
        onUpdate: ReferentialAction.setNull,
      });
    }
  );

  it('refuses an action it does not name', () => {
    const peer = seededPeer();

    const bad = refusal(() =>
      runTool(peer, 'erd_link_columns', { ...link, onDelete: 'CASCADE' })
    );

    expect(bad.code).toBe(ToolErrorCode.invalidArgs);
    expect(bad.message).toBe(
      'onDelete must be one of none, noAction, cascade, setNull, setDefault, restrict'
    );
    expect(peer.state.doc.relationshipIds).toEqual([SEED.relationship]);
  });
});

describe.each([
  ['erd_change_relationship_on_delete', 'onDelete', 'ON DELETE'],
  ['erd_change_relationship_on_update', 'onUpdate', 'ON UPDATE'],
] as const)('%s sets one referential action', (tool, field, clause) => {
  const snapshotRelationship = (peer: PeerStore) =>
    JSON.parse(readDocument(peer.state, 'snapshot')).relationships[0];

  it('writes the action by name, which the snapshot and the DDL read back', () => {
    const peer = seededPeer();

    const run = runTool(peer, tool, {
      relationshipId: SEED.relationship,
      [field]: 'setNull',
    });

    expect(run).toMatchObject({ batches: 1, historyEntries: 1 });
    expect(run.actions.map(({ type }) => type)).toEqual([
      field === 'onDelete'
        ? 'relationship.changeOnDelete'
        : 'relationship.changeOnUpdate',
    ]);
    expect(snapshotRelationship(peer)[field]).toBe('setNull');
    expect(readDocument(peer.state, 'sql', 'PostgreSQL')).toContain(
      `    ${clause} SET NULL;`
    );
  });

  it('takes the action back with one undo, and leaves the other alone', () => {
    const peer = seededPeer();
    const other = field === 'onDelete' ? 'onUpdate' : 'onDelete';

    runTool(peer, tool, {
      relationshipId: SEED.relationship,
      [field]: 'cascade',
    });
    expect(snapshotRelationship(peer)[other]).toBe('none');
    peer.undo();

    expect(snapshotRelationship(peer)[field]).toBe('none');
  });

  it('refuses an action it does not name and a removed relationship', () => {
    const peer = seededPeer();

    const badAction = refusal(() =>
      runTool(peer, tool, {
        relationshipId: SEED.relationship,
        [field]: 'SET NULL',
      })
    );
    runTool(peer, 'erd_remove_relationship', {
      relationshipId: SEED.relationship,
    });
    const gone = refusal(() =>
      runTool(peer, tool, {
        relationshipId: SEED.relationship,
        [field]: 'cascade',
      })
    );

    expect(badAction.code).toBe(ToolErrorCode.invalidArgs);
    expect(badAction.message).toBe(
      `${field} must be one of none, noAction, cascade, setNull, setDefault, restrict`
    );
    expect(gone.code).toBe(ToolErrorCode.notFound);
  });
});

describe('the foreign key data types the descriptions of erd_add_relationship, erd_change_column_data_type and erd_set_relationship_data_type_sync state', () => {
  const dataTypeOf = (peer: PeerStore, columnId: string) =>
    peer.state.collections.tableColumnEntities[columnId].dataType;

  const setDataType = (
    peer: PeerStore,
    tableId: string,
    columnId: string,
    value: string
  ) =>
    runTool(peer, 'erd_change_column_data_type', { tableId, columnId, value });

  it('gives the foreign key of a serial key the integer it stores, sync off too', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_set_database', { value: 'PostgreSQL' });
    runTool(peer, 'erd_set_relationship_data_type_sync', { value: false });
    setDataType(peer, SEED.users, SEED.userId, 'BIGSERIAL');
    expect(dataTypeOf(peer, SEED.orderUser)).toBe('INT');

    const [foreignKeyId] = relate(peer, SEED.users, SEED.empty).createdIds;

    expect(dataTypeOf(peer, foreignKeyId)).toBe('BIGINT');
  });

  it('maps a bare serial by the document database', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_set_database', { value: 'MySQL' });
    setDataType(peer, SEED.users, SEED.userId, 'serial');

    const [foreignKeyId] = relate(peer, SEED.users, SEED.empty).createdIds;

    expect(dataTypeOf(peer, foreignKeyId)).toBe('bigint unsigned');
  });

  it('syncs both ways and stops a foreign key change at a serial key', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_set_database', { value: 'PostgreSQL' });
    runTool(peer, 'erd_set_relationship_data_type_sync', { value: true });

    setDataType(peer, SEED.orders, SEED.orderUser, 'BIGINT');
    expect(dataTypeOf(peer, SEED.userId)).toBe('BIGINT');

    setDataType(peer, SEED.users, SEED.userId, 'SERIAL');
    expect(dataTypeOf(peer, SEED.orderUser)).toBe('INTEGER');

    setDataType(peer, SEED.orders, SEED.orderUser, 'BIGINT');
    expect(dataTypeOf(peer, SEED.userId)).toBe('SERIAL');
    expect(dataTypeOf(peer, SEED.orderUser)).toBe('BIGINT');
  });

  it('keeps a serial type set on a foreign key there, its key as it was', () => {
    const peer = seededPeer();
    runTool(peer, 'erd_set_database', { value: 'PostgreSQL' });
    runTool(peer, 'erd_set_relationship_data_type_sync', { value: true });

    setDataType(peer, SEED.orders, SEED.orderUser, ' BigSerial ');

    expect(dataTypeOf(peer, SEED.orderUser)).toBe(' BigSerial ');
    expect(dataTypeOf(peer, SEED.userId)).toBe('INT');
  });
});
