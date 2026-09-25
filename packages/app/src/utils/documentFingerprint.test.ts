import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import {
  createPeerStore,
  tableActions,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { toDriveFingerprint, toFingerprint } from '@/utils/documentFingerprint';
import { toWidth } from '@/utils/text';

/** A table with a column, as the engine serializes it. */
function documentValue() {
  const store = createReplicationStore({ toWidth });
  store.setInitialValue('');
  store.dispatchSync([
    {
      type: 'table.add',
      payload: {
        id: 'users',
        ui: { x: 0, y: 0, zIndex: 1, widthName: 60, widthComment: 60 },
      },
    },
    { type: 'column.add', payload: { id: 'users.id', tableId: 'users' } },
  ] as any);
  const value = store.value;
  store.destroy();
  return value;
}

const VALUE = documentValue();

function changed(change: (json: any) => void, value = VALUE) {
  const json = JSON.parse(value);
  change(json);
  return JSON.stringify(json);
}

const META = { updateAt: 1, createAt: 1 };

/** VALUE with orders removed, its column, index and relationship, and a removed memo. */
const TOMBSTONES = changed(({ collections }) => {
  const { users } = collections.tableEntities;
  collections.tableEntities.orders = { ...users, id: 'orders', meta: META };
  collections.tableColumnEntities['orders.id'] = {
    ...collections.tableColumnEntities['users.id'],
    id: 'orders.id',
    tableId: 'orders',
    meta: META,
  };
  collections.indexEntities.byOrder = {
    id: 'byOrder',
    tableId: 'orders',
    meta: META,
  };
  collections.indexColumnEntities['byOrder.id'] = {
    id: 'byOrder.id',
    indexId: 'byOrder',
    meta: META,
  };
  const end = (tableId: string) => ({ tableId, x: 0, y: 0, direction: 1 });
  collections.relationshipEntities.placed = {
    id: 'placed',
    start: end('users'),
    end: end('orders'),
    meta: META,
  };
  collections.memoEntities.note = { id: 'note', value: 'x', meta: META };
});

/** The same entities, all of them in the document. */
const LIVE = changed(({ doc }) => {
  doc.tableIds.push('orders');
  doc.relationshipIds.push('placed');
  doc.indexIds.push('byOrder');
  doc.memoIds.push('note');
}, TOMBSTONES);

const viewChanges: Array<[string, (json: any) => void]> = [
  ['scrollTop', json => (json.settings.scrollTop += 10)],
  ['scrollLeft', json => (json.settings.scrollLeft += 10)],
  ['originX', json => (json.settings.originX += 10)],
  ['originY', json => (json.settings.originY -= 10)],
  ['zoomLevel', json => (json.settings.zoomLevel = 0.5)],
  ['canvasType', json => (json.settings.canvasType = 'settings')],
];

const derivedChanges: Array<[string, (json: any) => void]> = [
  [
    'a table width',
    json => (json.collections.tableEntities.users.ui.widthName = 999),
  ],
  [
    'a column width',
    json =>
      (json.collections.tableColumnEntities['users.id'].ui.widthDataType = 999),
  ],
  [
    'the foreign key bit',
    json => (json.collections.tableColumnEntities['users.id'].ui.keys |= 2),
  ],
];

const documentChanges: Array<[string, (json: any) => void]> = [
  ['the database', json => (json.settings.database += 1)],
  ['what is shown', json => (json.settings.show ^= 1)],
  ['the column order', json => json.settings.columnOrder.reverse()],
  ['the database name', json => (json.settings.databaseName = 'shop')],
  [
    'a table name',
    json => (json.collections.tableEntities.users.name = 'people'),
  ],
  ['a table position', json => (json.collections.tableEntities.users.ui.x = 1)],
];

describe('toFingerprint', () => {
  it.each(viewChanges)('ignores %s', (_name, change) => {
    expect(toFingerprint(changed(change))).toBe(toFingerprint(VALUE));
  });

  it.each(derivedChanges)('ignores %s the engine derives', (_name, change) => {
    expect(toFingerprint(changed(change))).toBe(toFingerprint(VALUE));
  });

  it('counts the database name and the document, and no other setting', () => {
    const databaseName = changed(json => (json.settings.databaseName = 'shop'));
    const tableName = changed(
      json => (json.collections.tableEntities.users.name = 'people')
    );
    const database = changed(json => (json.settings.database += 1));

    expect(toFingerprint(databaseName)).not.toBe(toFingerprint(VALUE));
    expect(toFingerprint(tableName)).not.toBe(toFingerprint(VALUE));
    expect(toFingerprint(database)).toBe(toFingerprint(VALUE));
  });
});

describe('toDriveFingerprint', () => {
  it.each(viewChanges)('ignores %s', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).toBe(toDriveFingerprint(VALUE));
  });

  it.each(derivedChanges)('ignores %s the engine derives', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).toBe(toDriveFingerprint(VALUE));
  });

  it.each(documentChanges)('tells %s apart', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).not.toBe(
      toDriveFingerprint(VALUE)
    );
  });

  it('ignores every view setting at once', () => {
    const viewed = changed(json =>
      viewChanges.forEach(([, change]) => change(json))
    );
    expect(toDriveFingerprint(viewed)).toBe(toDriveFingerprint(VALUE));
  });

  describe('what no longer hangs off the document', () => {
    it('leaves out a removed table and memo and what belonged to the table', () => {
      expect(toDriveFingerprint(TOMBSTONES)).toBe(toDriveFingerprint(VALUE));
    });

    it('leaves out a relationship and an index the document still lists on a removed table', () => {
      const dangling = changed(({ doc }) => {
        doc.relationshipIds.push('placed', 'gone');
        doc.indexIds.push('byOrder', 'gone');
      }, TOMBSTONES);

      expect(toDriveFingerprint(dangling)).toBe(toDriveFingerprint(VALUE));
    });

    it.each([
      ['relationship', 'relationshipIds', 'relationshipEntities', 'placed'],
      ['index', 'indexIds', 'indexEntities', 'byOrder'],
      ['memo', 'memoIds', 'memoEntities', 'note'],
    ])('tells a %s the document holds apart', (_name, ids, entities, id) => {
      const without = changed(({ doc, collections }) => {
        doc[ids] = doc[ids].filter((kept: string) => kept !== id);
        delete collections[entities][id];
      }, LIVE);

      expect(toDriveFingerprint(without)).not.toBe(toDriveFingerprint(LIVE));
    });

    it('tells a column of an index the document holds apart', () => {
      const without = changed(({ collections }) => {
        delete collections.indexColumnEntities['byOrder.id'];
      }, LIVE);

      expect(toDriveFingerprint(without)).not.toBe(toDriveFingerprint(LIVE));
    });
  });

  describe('across replicas', () => {
    afterEach(() => vi.useRealTimers());

    it('is the same for two replicas of one edit, whose entity meta differs', () => {
      vi.useFakeTimers({ now: Date.UTC(2026, 8, 25) });
      const here = createPeerStore({ nickname: 'here', presence: false });
      const there = createPeerStore({ nickname: 'there', presence: false });
      here.setInitialValue(VALUE);
      there.setInitialValue(VALUE);
      const sent: unknown[][] = [];
      here.subscribe(actions => sent.push(actions));
      there.subscribe(() => {});

      const [id] = here.dispatch([tableActions$.addTableAction$()]).createdIds;
      here.dispatch([tableActions.changeTableNameAction({ id, value: 'x' })]);
      here.flushStreamBuffers();
      // The other tab applies the batches a second later, by its own clock.
      vi.advanceTimersByTime(1000);
      for (const actions of sent) there.receive(actions as any);

      const metaOf = (value: string) =>
        JSON.parse(value).collections.tableEntities[id].meta;
      expect(metaOf(there.value)).not.toEqual(metaOf(here.value));
      expect(toDriveFingerprint(there.value)).toBe(
        toDriveFingerprint(here.value)
      );
      here.destroy();
      there.destroy();
    });

    it('is the same for two replicas that applied two adds in opposite orders', () => {
      vi.useFakeTimers({ now: Date.UTC(2026, 8, 25) });
      const here = createPeerStore({ nickname: 'here', presence: false });
      const there = createPeerStore({ nickname: 'there', presence: false });
      here.setInitialValue(VALUE);
      there.setInitialValue(VALUE);
      const fromHere: unknown[][] = [];
      const fromThere: unknown[][] = [];
      here.subscribe(actions => fromHere.push(actions));
      there.subscribe(actions => fromThere.push(actions));

      // Each tab adds a table before the other's batch arrives.
      const [mine] = here.dispatch([
        tableActions$.addTableAction$(),
      ]).createdIds;
      const [theirs] = there.dispatch([
        tableActions$.addTableAction$(),
      ]).createdIds;
      here.flushStreamBuffers();
      there.flushStreamBuffers();
      vi.advanceTimersByTime(1000);
      for (const actions of fromThere) here.receive(actions as any);
      for (const actions of fromHere) there.receive(actions as any);

      const order = (value: string) =>
        JSON.parse(value).doc.tableIds.filter((id: string) =>
          [mine, theirs].includes(id)
        );
      expect(order(here.value)).toEqual([mine, theirs]);
      expect(order(there.value)).toEqual([theirs, mine]);
      expect(toDriveFingerprint(there.value)).toBe(
        toDriveFingerprint(here.value)
      );
      here.destroy();
      there.destroy();
    });
  });

  describe('in any order', () => {
    /** LIVE with a second memo, relationship and index, so every list has two. */
    const TWO_OF_EACH = changed(({ doc, collections }) => {
      const copy = (ids: string, entities: string, from: string) => {
        const id = `${from}2`;
        collections[entities][id] = { ...collections[entities][from], id };
        doc[ids].push(id);
      };
      copy('memoIds', 'memoEntities', 'note');
      copy('relationshipIds', 'relationshipEntities', 'placed');
      copy('indexIds', 'indexEntities', 'byOrder');
    }, LIVE);

    it.each([
      ['tableIds', 'tableEntities'],
      ['memoIds', 'memoEntities'],
      ['relationshipIds', 'relationshipEntities'],
      ['indexIds', 'indexEntities'],
    ])('holds %s and %s to no order', (ids, entities) => {
      const reordered = changed(({ doc, collections }) => {
        doc[ids].reverse();
        collections[entities] = Object.fromEntries(
          Object.entries(collections[entities]).reverse()
        );
      }, TWO_OF_EACH);

      expect(JSON.parse(reordered).doc[ids]).toHaveLength(2);
      expect(toDriveFingerprint(reordered)).toBe(
        toDriveFingerprint(TWO_OF_EACH)
      );
    });

    it('still tells an entity the document gained apart', () => {
      expect(toDriveFingerprint(TWO_OF_EACH)).not.toBe(
        toDriveFingerprint(LIVE)
      );
    });
  });
});
