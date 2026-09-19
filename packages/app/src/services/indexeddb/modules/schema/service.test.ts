import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vite-plus/test';

import type { AppDatabase } from '@/services/indexeddb/appDatabaseService';
import type { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { SchemaService } from '@/services/indexeddb/modules/schema/service';
import { updateSchemaEntityAction } from '@/utils/broadcastChannel';
import { toWidth } from '@/utils/text';

const DAY = 24 * 60 * 60 * 1000;
const CREATED = Date.UTC(2026, 8, 1, 9);
const OPENED = Date.UTC(2026, 8, 19, 9);

/** The slice of a Dexie table the schema module touches, kept in memory. */
function createFakeDatabase() {
  const rows = new Map<string, SchemaEntity>();
  const table = {
    add: async (entity: SchemaEntity) => {
      rows.set(entity.id, structuredClone(entity));
      return entity.id;
    },
    bulkAdd: async (entities: SchemaEntity[]) => {
      entities.forEach(entity => rows.set(entity.id, structuredClone(entity)));
    },
    update: async (id: string, changes: Partial<SchemaEntity>) => {
      const row = rows.get(id);
      if (!row) return 0;
      Object.assign(row, structuredClone(changes));
      return 1;
    },
    delete: async (id: string) => {
      rows.delete(id);
    },
    get: async (id: string) => structuredClone(rows.get(id)),
    toArray: async () => Array.from(rows.values(), row => structuredClone(row)),
  };

  return {
    rows,
    db: { table: () => table } as unknown as AppDatabase,
  };
}

function valueOf(actions: any[] = []) {
  const store = createReplicationStore({ toWidth });
  store.setInitialValue('');
  store.dispatchSync(actions);
  const value = store.value;
  store.destroy();
  return value;
}

function seed(
  rows: Map<string, SchemaEntity>,
  entity: Partial<SchemaEntity> = {}
): SchemaEntity {
  const row: SchemaEntity = {
    id: 'schema-1',
    name: 'Orders',
    value: valueOf(),
    createAt: CREATED,
    updateAt: CREATED,
    ...entity,
  };
  rows.set(row.id, structuredClone(row));
  return row;
}

const settle = () => vi.advanceTimersByTimeAsync(1000);

const addTable = (id: string, x: number) => ({
  type: 'table.add',
  payload: {
    id,
    ui: { x, y: 0, zIndex: 1, widthName: 60, widthComment: 60, color: '' },
  },
});

/** Two tables, a key column in each, and the relationship between them. */
const usersAndOrders = [
  addTable('users', 0),
  addTable('orders', 600),
  { type: 'table.changeName', payload: { id: 'users', value: 'users' } },
  { type: 'table.changeName', payload: { id: 'orders', value: 'orders' } },
  { type: 'column.add', payload: { id: 'users.id', tableId: 'users' } },
  {
    type: 'column.changeName',
    payload: { id: 'users.id', tableId: 'users', value: 'id' },
  },
  {
    type: 'column.changePrimaryKey',
    payload: { id: 'users.id', tableId: 'users', value: true },
  },
  { type: 'column.add', payload: { id: 'orders.user', tableId: 'orders' } },
  {
    type: 'column.changeName',
    payload: { id: 'orders.user', tableId: 'orders', value: 'user_id' },
  },
  {
    type: 'column.changeNotNull',
    payload: { id: 'orders.user', tableId: 'orders', value: true },
  },
  {
    type: 'relationship.add',
    payload: {
      id: 'placed',
      relationshipType: 16,
      start: { tableId: 'users', columnIds: ['users.id'] },
      end: { tableId: 'orders', columnIds: ['orders.user'] },
    },
  },
];

/** A document as the engine leaves it once its hooks have run, derived fields included. */
async function settledValueOf(actions: any[]) {
  const store = createReplicationStore({ toWidth });
  store.setInitialValue('');
  store.dispatchSync(actions);
  await settle();
  const value = store.value;
  store.destroy();
  return value;
}

type Collections = Record<string, Record<string, any>>;

/**
 * Each field the engine derives after a load, as another machine or build could
 * have saved it: text widths measured with other fonts, connector anchors from
 * other routing, and the flags read off the columns and relationships.
 */
const foreignDerivedFields: Array<
  [string, (collections: Collections) => void]
> = [
  [
    'table and column widths',
    ({ tableEntities, tableColumnEntities }) => {
      tableEntities.users.ui.widthName = 999;
      tableEntities.orders.ui.widthComment = 999;
      tableColumnEntities['orders.user'].ui.widthName = 999;
      tableColumnEntities['orders.user'].ui.widthDataType = 999;
      tableColumnEntities['users.id'].ui.widthDefault = 999;
      tableColumnEntities['users.id'].ui.widthComment = 999;
    },
  ],
  [
    'connector anchors',
    ({ relationshipEntities: { placed } }) => {
      placed.start.x += 37;
      placed.start.y += 11;
      placed.end.direction = placed.end.direction === 1 ? 2 : 1;
    },
  ],
  [
    'relationship flags',
    ({ relationshipEntities: { placed } }) => {
      placed.identification = !placed.identification;
      placed.startRelationshipType = placed.startRelationshipType === 1 ? 2 : 1;
    },
  ],
  [
    'the foreign key bit',
    ({ tableColumnEntities }) => {
      tableColumnEntities['orders.user'].ui.keys = 0;
    },
  ],
];

function withForeignFields(
  value: string,
  changes: Array<(collections: Collections) => void>
) {
  const json = JSON.parse(value);
  changes.forEach(change => change(json.collections));
  return JSON.stringify(json);
}

/**
 * The document as an import converts a source: laid out, but read before the
 * engine's hooks place its connectors and set the flags read off its columns,
 * so every relationship still holds what the parser created it with.
 */
function asConverted(value: string) {
  const json = JSON.parse(value);
  const unplaced = { x: 0, y: 0, direction: 8 };

  for (const relationship of Object.values<any>(
    json.collections.relationshipEntities
  )) {
    Object.assign(relationship.start, unplaced);
    Object.assign(relationship.end, unplaced);
    relationship.identification = false;
    relationship.startRelationshipType = 2;
  }
  return JSON.stringify(json);
}

const zoomAndScroll = [
  { type: 'settings.changeZoomLevel', payload: { value: 0.5 } },
  { type: 'settings.streamZoomLevel', payload: { value: 0.1 } },
  { type: 'settings.scrollTo', payload: { originX: -120, originY: 80 } },
  { type: 'settings.streamScrollTo', payload: { movementX: 5, movementY: 5 } },
  { type: 'settings.changeCanvasType', payload: { value: 'SQL' } },
];

const renameDatabase = (value: string) => ({
  type: 'settings.changeDatabaseName',
  payload: { value },
});

describe('SchemaService', () => {
  let rows: Map<string, SchemaEntity>;
  let service: SchemaService;
  let postMessage: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(OPENED);
    postMessage = vi.spyOn(BroadcastChannel.prototype, 'postMessage');

    const database = createFakeDatabase();
    rows = database.rows;
    service = new SchemaService(database.db);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('updateAt', () => {
    it('stays put when a schema is opened and left alone', async () => {
      const row = seed(rows);

      await service.get(row.id);
      await settle();

      expect(rows.get(row.id)).toEqual(row);
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('saves zoom, scroll and canvas type without counting them as an edit', async () => {
      const row = seed(rows);

      await service.replication(row.id, zoomAndScroll);
      await settle();

      const saved = rows.get(row.id)!;
      expect(saved.updateAt).toBe(CREATED);
      expect(JSON.parse(saved.value).settings).toMatchObject({
        zoomLevel: 0.6,
        canvasType: 'SQL',
      });
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('stamps a content edit and tells every tab', async () => {
      const row = seed(rows);

      await service.replication(row.id, [renameDatabase('shop')]);
      await settle();

      const saved = rows.get(row.id)!;
      expect(JSON.parse(saved.value).settings.databaseName).toBe('shop');
      expect(saved.updateAt).toBeGreaterThanOrEqual(OPENED);
      expect(saved.updateAt).toBeLessThanOrEqual(Date.now());
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith(
        updateSchemaEntityAction({
          id: row.id,
          entityValue: { updateAt: saved.updateAt },
        })
      );
    });

    it('counts a document change as an edit', async () => {
      const row = seed(rows);

      await service.replication(row.id, [
        {
          type: 'memo.add',
          payload: { id: 'm1', ui: { x: 1, y: 2, zIndex: 3 } },
        },
      ]);
      await settle();

      expect(rows.get(row.id)!.updateAt).toBeGreaterThanOrEqual(OPENED);
      expect(JSON.parse(rows.get(row.id)!.value).doc.memoIds).toEqual(['m1']);
    });

    it('measures the next change against the last save', async () => {
      const row = seed(rows);

      await service.replication(row.id, [renameDatabase('shop')]);
      await settle();
      const edited = rows.get(row.id)!.updateAt;
      vi.setSystemTime(OPENED + DAY);
      await service.replication(row.id, zoomAndScroll);
      await settle();

      expect(edited).toBeGreaterThanOrEqual(OPENED);
      expect(rows.get(row.id)!.updateAt).toBe(edited);
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    it('takes the baseline from the loaded replica, not the stored string', async () => {
      // A new schema is stored as an empty string, which is not JSON at all.
      const row = seed(rows, { value: '' });

      await service.replication(row.id, zoomAndScroll);
      await settle();

      expect(rows.get(row.id)!.updateAt).toBe(CREATED);
      expect(JSON.parse(rows.get(row.id)!.value).settings.zoomLevel).toBe(0.6);
    });

    it('does not count the tombstones the engine collects on load as an edit', async () => {
      vi.setSystemTime(OPENED - 10 * DAY);
      const value = valueOf([
        {
          type: 'memo.add',
          payload: { id: 'm1', ui: { x: 1, y: 2, zIndex: 3 } },
        },
        { type: 'memo.remove', payload: { id: 'm1' } },
      ]);
      vi.setSystemTime(OPENED);
      expect(JSON.parse(value).collections.memoEntities).toHaveProperty('m1');
      const row = seed(rows, { value });

      await service.replication(row.id, zoomAndScroll);
      await settle();

      const saved = rows.get(row.id)!;
      expect(JSON.parse(saved.value).collections.memoEntities).toEqual({});
      expect(saved.updateAt).toBe(CREATED);
      expect(postMessage).not.toHaveBeenCalled();
    });

    describe('on a document whose derived fields were saved elsewhere', () => {
      let settled: string;
      let row: SchemaEntity;

      beforeEach(async () => {
        settled = await settledValueOf(usersAndOrders);
        row = seed(rows, {
          value: withForeignFields(
            settled,
            foreignDerivedFields.map(([, change]) => change)
          ),
        });
      });

      it('starts from a document the engine has derived its fields for', () => {
        const { doc, collections } = JSON.parse(settled);

        expect(doc.relationshipIds).toEqual(['placed']);
        expect(collections.tableColumnEntities['orders.user'].ui.keys).toBe(2);
      });

      it.each(foreignDerivedFields)(
        'lets the replica derive %s again without counting it an edit',
        async (_, change) => {
          const value = withForeignFields(settled, [change]);
          expect(value).not.toBe(settled);
          seed(rows, { value });

          await service.get(row.id);
          await settle();
          const [replica] = await service.getAllWithValue();
          expect(JSON.parse(replica.value).collections).toEqual(
            JSON.parse(settled).collections
          );

          await service.replication(row.id, zoomAndScroll);
          await settle();

          const saved = rows.get(row.id)!;
          expect(JSON.parse(saved.value).settings.zoomLevel).toBe(0.6);
          expect(saved.updateAt).toBe(CREATED);
          expect(postMessage).not.toHaveBeenCalled();
        }
      );

      it.each([
        [
          'a table rename',
          {
            type: 'table.changeName',
            payload: { id: 'orders', value: 'sales' },
          },
        ],
        [
          'a column type',
          {
            type: 'column.changeDataType',
            payload: { id: 'users.id', tableId: 'users', value: 'BIGINT' },
          },
        ],
        [
          'a table move',
          {
            type: 'table.move',
            payload: { ids: ['orders'], movementX: 40, movementY: 0 },
          },
        ],
        [
          'a relationship type',
          {
            type: 'relationship.changeType',
            payload: { id: 'placed', value: 8 },
          },
        ],
        [
          'a dropped primary key',
          {
            type: 'column.changePrimaryKey',
            payload: { id: 'users.id', tableId: 'users', value: false },
          },
        ],
      ])('still stamps %s', async (_, edit) => {
        await service.get(row.id);
        await settle();
        await service.replication(row.id, [edit]);
        await settle();

        const saved = rows.get(row.id)!;
        expect(saved.updateAt).toBeGreaterThanOrEqual(OPENED);
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith(
          updateSchemaEntityAction({
            id: row.id,
            entityValue: { updateAt: saved.updateAt },
          })
        );
      });
    });

    it('re-takes the baseline when the value is replaced', async () => {
      const row = seed(rows);

      await service.get(row.id);
      await service.update(row.id, {
        value: valueOf([renameDatabase('imported')]),
        updateAt: OPENED,
      });
      vi.setSystemTime(OPENED + DAY);
      await service.replication(row.id, zoomAndScroll);
      await settle();

      const saved = rows.get(row.id)!;
      expect(saved.updateAt).toBe(OPENED);
      expect(JSON.parse(saved.value).settings).toMatchObject({
        databaseName: 'imported',
        zoomLevel: 0.6,
      });
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('leaves a deleted schema alone when its last change was still pending', async () => {
      const row = seed(rows);

      await service.replication(row.id, [renameDatabase('shop')]);
      await vi.advanceTimersByTimeAsync(0);
      await service.delete(row.id);
      await settle();

      expect(rows.has(row.id)).toBe(false);
      expect(postMessage).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('renames without touching updateAt', async () => {
      const row = seed(rows);
      await service.get(row.id);

      await expect(service.update(row.id, { name: 'Invoices' })).resolves.toBe(
        true
      );

      expect(rows.get(row.id)).toMatchObject({
        name: 'Invoices',
        updateAt: CREATED,
      });
      await expect(service.get(row.id)).resolves.toMatchObject({
        name: 'Invoices',
        updateAt: CREATED,
      });
    });

    it('moves to the trash and back without touching updateAt', async () => {
      const row = seed(rows);
      await service.get(row.id);

      await service.update(row.id, { deletedAt: OPENED });
      await expect(service.getAll()).resolves.toEqual([
        {
          id: row.id,
          name: row.name,
          createAt: CREATED,
          updateAt: CREATED,
          deletedAt: OPENED,
        },
      ]);
      await expect(service.get(row.id)).resolves.toMatchObject({
        deletedAt: OPENED,
      });

      await service.update(row.id, { deletedAt: null });
      expect(rows.get(row.id)).toMatchObject({
        deletedAt: null,
        updateAt: CREATED,
      });
    });

    it('reports a schema that is not stored', async () => {
      await expect(service.update('missing', { name: 'x' })).resolves.toBe(
        false
      );
    });
  });

  describe('add', () => {
    it('stores an empty schema stamped now', async () => {
      const result = await service.add({ name: 'Blog' });

      expect(result).toEqual({
        id: expect.any(String),
        name: 'Blog',
        value: '',
        createAt: OPENED,
        updateAt: OPENED,
      });
      expect(rows.get(result.id)).toEqual(result);
    });

    it('keeps a value and times it is given', async () => {
      const value = valueOf([renameDatabase('shop')]);
      const result = await service.add({
        name: 'Blog',
        value,
        createAt: CREATED,
        updateAt: CREATED + DAY,
      });

      expect(rows.get(result.id)).toEqual({
        id: result.id,
        name: 'Blog',
        value,
        createAt: CREATED,
        updateAt: CREATED + DAY,
      });
    });

    it('lists schemas without their values', async () => {
      const row = seed(rows);

      await expect(service.getAll()).resolves.toEqual([
        {
          id: row.id,
          name: row.name,
          createAt: CREATED,
          updateAt: CREATED,
        },
      ]);
    });
  });

  describe('import', () => {
    it('stores every schema under a new id, times kept or stamped now', async () => {
      const value = valueOf([renameDatabase('shop')]);

      const result = await service.import([
        { name: 'Orders', value, createAt: CREATED, updateAt: CREATED + DAY },
        { name: 'Blog' },
      ]);

      expect(result).toEqual([
        {
          id: expect.any(String),
          name: 'Orders',
          value,
          createAt: CREATED,
          updateAt: CREATED + DAY,
        },
        {
          id: expect.any(String),
          name: 'Blog',
          value: '',
          createAt: OPENED,
          updateAt: OPENED,
        },
      ]);
      expect(result[0].id).not.toBe(result[1].id);
      expect(Array.from(rows.values())).toEqual(result);
    });

    it('derives on first open what a converted source left out, as no edit, and stamps the next edit', async () => {
      const settled = await settledValueOf(usersAndOrders);
      const converted = asConverted(settled);
      expect(converted).not.toBe(settled);
      const [imported] = await service.import([
        { name: 'Orders', value: converted },
      ]);

      await service.get(imported.id);
      await settle();
      await service.replication(imported.id, zoomAndScroll);
      await settle();

      const saved = rows.get(imported.id)!;
      expect(JSON.parse(saved.value).collections).toEqual(
        JSON.parse(settled).collections
      );
      expect(saved.updateAt).toBe(imported.updateAt);
      expect(postMessage).not.toHaveBeenCalled();

      vi.setSystemTime(OPENED + DAY);
      await service.replication(imported.id, [
        { type: 'table.changeName', payload: { id: 'orders', value: 'sales' } },
      ]);
      await settle();

      const edited = rows.get(imported.id)!;
      expect(edited.updateAt).toBeGreaterThanOrEqual(OPENED + DAY);
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith(
        updateSchemaEntityAction({
          id: imported.id,
          entityValue: { updateAt: edited.updateAt },
        })
      );
    });

    it('does not count opening an imported schema as an edit', async () => {
      const [imported] = await service.import([
        {
          name: 'Orders',
          value: valueOf([renameDatabase('shop')]),
          createAt: CREATED,
          updateAt: CREATED,
        },
      ]);

      await service.get(imported.id);
      await service.replication(imported.id, zoomAndScroll);
      await settle();

      expect(rows.get(imported.id)!.updateAt).toBe(CREATED);
      expect(postMessage).not.toHaveBeenCalled();
    });
  });

  describe('getAllWithValue', () => {
    it('gives every schema with its value, the open replica ahead of the store', async () => {
      const opened = seed(rows);
      const closed = seed(rows, {
        id: 'schema-2',
        value: valueOf([renameDatabase('stored')]),
        deletedAt: OPENED,
      });
      await service.replication(opened.id, [renameDatabase('shop')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(rows.get(opened.id)!.value).toBe(opened.value);

      const list = await service.getAllWithValue();

      expect(list).toHaveLength(2);
      const [first, second] = list;
      expect(JSON.parse(first.value).settings.databaseName).toBe('shop');
      expect(first).toMatchObject({ id: opened.id, updateAt: CREATED });
      expect(second).toEqual(closed);
    });
  });

  describe('duplicate', () => {
    it('copies the replica, edits not yet saved included, into a new schema', async () => {
      const row = seed(rows);
      await service.replication(row.id, [renameDatabase('shop')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(rows.get(row.id)!.value).toBe(row.value);

      const copy = await service.duplicate(row.id, { name: 'Orders copy' });

      expect(copy).toMatchObject({
        name: 'Orders copy',
        createAt: OPENED,
        updateAt: OPENED,
      });
      expect(copy!.id).not.toBe(row.id);
      expect(JSON.parse(rows.get(copy!.id)!.value).settings.databaseName).toBe(
        'shop'
      );
    });

    it('copies the stored value of a schema that was never opened', async () => {
      const row = seed(rows, { value: valueOf([renameDatabase('stored')]) });

      const copy = await service.duplicate(row.id, { name: 'Orders copy' });

      expect(copy!.value).toBe(row.value);
      await expect(service.get(copy!.id)).resolves.toMatchObject({
        name: 'Orders copy',
      });
    });

    it('gives nothing back for a schema that is not stored', async () => {
      await expect(
        service.duplicate('missing', { name: 'x' })
      ).resolves.toBeUndefined();
      expect(rows.size).toBe(0);
    });
  });

  describe('delete', () => {
    it('drops the row and the replica', async () => {
      const row = seed(rows);
      await service.get(row.id);

      await service.delete(row.id);

      expect(rows.has(row.id)).toBe(false);
      await expect(service.get(row.id)).resolves.toBeUndefined();
    });

    it('ignores a schema that was never opened', async () => {
      const row = seed(rows);

      await service.delete(row.id);

      expect(rows.has(row.id)).toBe(false);
    });

    it('takes the same schema from two tabs purging the trash at once', async () => {
      const row = seed(rows, { deletedAt: CREATED });
      await service.get(row.id);

      await Promise.all([service.delete(row.id), service.delete(row.id)]);
      await service.delete(row.id);

      expect(rows.has(row.id)).toBe(false);
      await expect(service.get(row.id)).resolves.toBeUndefined();
    });
  });

  it('ignores replication for a schema that is not stored', async () => {
    await expect(
      service.replication('missing', zoomAndScroll)
    ).resolves.toBeUndefined();
    await settle();

    expect(rows.size).toBe(0);
  });
});
