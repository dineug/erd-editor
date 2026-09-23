import {
  createPeerStore,
  defaultToWidth,
  measureTableSize,
  type PeerStore,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, createSeedValue, SEED } from '@/__test-utils__/seed';
import { toDocumentList, toEntityDetails } from '@/tools/outline';
import { runTool } from '@/tools/run';
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

const tableOf = (peer: PeerStore, id: string) =>
  peer.state.collections.tableEntities[id];

/** Past the throttle of the hook that re-measures a loaded document. */
const settled = () => new Promise(resolve => setTimeout(resolve, 30));

describe('the document list', () => {
  it('lists every live entity by id, in document order, with the snapshot settings', () => {
    const peer = seeded();
    const list = toDocumentList(peer.state);

    expect(list.settings).toEqual(toAgentSnapshot(peer.state).settings);
    expect(list).toMatchObject({
      tableCount: 3,
      relationshipCount: 1,
      indexCount: 1,
      memoCount: 1,
    });
    expect(Object.keys(list)).toEqual([
      'settings',
      'tableCount',
      'relationshipCount',
      'indexCount',
      'memoCount',
      'tables',
      'relationships',
      'indexes',
      'memos',
    ]);
    expect(
      list.tables.map(({ id, name, x, y, columnCount }) => ({
        id,
        name,
        x,
        y,
        columnCount,
      }))
    ).toEqual([
      { id: SEED.users, name: 'users', x: 100, y: 100, columnCount: 2 },
      { id: SEED.orders, name: 'orders', x: 500, y: 100, columnCount: 3 },
      { id: SEED.empty, name: 'empty', x: 100, y: 500, columnCount: 0 },
    ]);
    expect(list.relationships).toEqual([
      {
        id: SEED.relationship,
        relationshipType: 'OneN',
        startTableId: SEED.users,
        endTableId: SEED.orders,
      },
    ]);
    expect(list.indexes).toEqual([
      { id: SEED.index, tableId: SEED.orders, name: '', unique: false },
    ]);
    expect(list.memos).toEqual([
      expect.objectContaining({ id: SEED.memo, x: 900, y: 100 }),
    ]);
    expect(Object.keys(list.memos[0])).toEqual([
      'id',
      'x',
      'y',
      'width',
      'height',
    ]);
  });

  it('sizes each table with the text measure of the peer hooks and the table sort', () => {
    const peer = seeded();
    const { tables } = toDocumentList(peer.state);

    for (const { id, width, height } of tables) {
      expect({ width, height }, id).toEqual(
        measureTableSize(tableOf(peer, id), peer.state, defaultToWidth)
      );
    }
  });

  it('estimates every text width, whatever the file carried and however long ago it was read', async () => {
    const document = JSON.parse(createSeedValue());
    document.collections.tableEntities[SEED.empty].ui.widthName = 900;
    const peer = createPeerStore({ nickname: 'agent', presence: false });
    peers.push(peer);
    peer.setInitialValue(JSON.stringify(document));
    const reference = toDocumentList(seeded().state).tables;

    // The peer's own hooks rewrite the loaded widths a few milliseconds on;
    // the list estimates on copies and leaves the loaded one where it was.
    expect(toDocumentList(peer.state).tables).toEqual(reference);
    expect(tableOf(peer, SEED.empty).ui.widthName).toBe(900);
    await settled();
    expect(tableOf(peer, SEED.empty).ui.widthName).not.toBe(900);
    expect(toDocumentList(peer.state).tables).toEqual(reference);
  });

  it('leaves the peer state as it found it, widths the peer would estimate otherwise included', () => {
    const document = JSON.parse(createSeedValue());
    document.collections.tableEntities[SEED.users].ui.widthName = 900;
    document.collections.tableColumnEntities[SEED.userName].ui.widthDataType =
      700;
    const peer = createPeerStore({ nickname: 'agent', presence: false });
    peers.push(peer);
    peer.setInitialValue(JSON.stringify(document));
    const before = peer.value;

    toDocumentList(peer.state);
    toEntityDetails(peer.state, { tableIds: [SEED.users] });

    expect(peer.value).toBe(before);
    expect(tableOf(peer, SEED.users).ui.widthName).toBe(900);
  });

  it('grows a table one row per column and widens it with its text', () => {
    const peer = seeded();
    const size = (id: string) =>
      toDocumentList(peer.state).tables.find(table => table.id === id)!;
    const empty = size(SEED.empty);
    const users = size(SEED.users);
    const orders = size(SEED.orders);

    expect(orders.height - users.height).toBe(
      (users.height - empty.height) / 2
    );
    expect(orders.height).toBeGreaterThan(users.height);

    runTool(peer, 'erd_change_table_name', {
      tableId: SEED.empty,
      value: 'a_table_name_long_enough_to_widen_the_whole_box',
    });
    expect(size(SEED.empty).width).toBeGreaterThan(empty.width);
    expect(size(SEED.empty).height).toBe(empty.height);
  });

  it('leaves out an entity the document removed, although its record stays', () => {
    const peer = seeded();
    runTool(peer, 'erd_remove_table', { tableId: SEED.empty });
    runTool(peer, 'erd_remove_memo', { memoId: SEED.memo });

    expect(peer.state.collections.tableEntities[SEED.empty]).toBeDefined();
    const list = toDocumentList(peer.state);
    expect(list.tables.map(({ id }) => id)).toEqual([SEED.users, SEED.orders]);
    expect(list.tableCount).toBe(2);
    expect(list.memos).toEqual([]);
  });

  it('stays a small part of the snapshot', () => {
    const peer = seeded();

    expect(JSON.stringify(toDocumentList(peer.state)).length).toBeLessThan(
      JSON.stringify(toAgentSnapshot(peer.state)).length
    );
  });
});

describe('the entity details', () => {
  it('gives a table as the snapshot does, with the size the list gives before its columns', () => {
    const peer = seeded();
    const { tables } = toEntityDetails(peer.state, { tableIds: [SEED.orders] });
    const { columns, ...snapshot } = toAgentSnapshot(peer.state).tables[1];
    const { width, height } = toDocumentList(peer.state).tables[1];

    expect(tables).toEqual([{ ...snapshot, width, height, columns }]);
    expect(Object.keys(tables![0]).slice(-3)).toEqual([
      'width',
      'height',
      'columns',
    ]);
  });

  it('answers only the kinds asked for, each in the order its ids came, once each', () => {
    const peer = seeded();
    const snapshot = toAgentSnapshot(peer.state);
    const details = toEntityDetails(peer.state, {
      tableIds: [SEED.empty, SEED.users, SEED.empty],
      memoIds: [SEED.memo],
    });

    expect(Object.keys(details)).toEqual(['tables', 'memos']);
    expect(details.tables!.map(({ id }) => id)).toEqual([
      SEED.empty,
      SEED.users,
    ]);
    expect(details.memos).toEqual(snapshot.memos);
  });

  it('gives relationships and indexes with their columns, as the snapshot does', () => {
    const peer = seeded();
    const snapshot = toAgentSnapshot(peer.state);

    expect(
      toEntityDetails(peer.state, {
        relationshipIds: [SEED.relationship],
        indexIds: [SEED.index],
      })
    ).toEqual({
      relationships: snapshot.relationships,
      indexes: snapshot.indexes,
    });
  });

  it('reports ids that name nothing live of their kind as missing', () => {
    const peer = seeded();
    runTool(peer, 'erd_remove_table', { tableId: SEED.empty });

    const details = toEntityDetails(peer.state, {
      tableIds: [SEED.users, SEED.empty, 'nope', SEED.memo],
      indexIds: [],
      memoIds: ['nope'],
    });

    expect(details.tables!.map(({ id }) => id)).toEqual([SEED.users]);
    expect(details.indexes).toEqual([]);
    expect(details.memos).toEqual([]);
    expect(details.missing).toEqual([SEED.empty, 'nope', SEED.memo]);
  });

  it('leaves missing out when every id is live', () => {
    const peer = seeded();

    expect(
      toEntityDetails(peer.state, { memoIds: [SEED.memo] })
    ).not.toHaveProperty('missing');
  });
});
