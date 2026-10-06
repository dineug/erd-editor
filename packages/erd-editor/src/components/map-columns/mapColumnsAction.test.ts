import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  addMapColumn,
  MapSeedColumn,
  seedMapRelationship,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { mapColumnsAction$ } from '@/components/map-columns/mapColumnsAction';
import { Database, RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { toForeignKeyActions } from '@/engine/modules/relationship/fkColumns';
import {
  changeDatabaseAction,
  changeRelationshipDataTypeSyncAction,
} from '@/engine/modules/settings/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import {
  changeColumnDataTypeAction,
  changeColumnPrimaryKeyAction,
  moveColumnAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import {
  buildMapColumns,
  openCreateSession,
  pickMapColumn,
} from '@/utils/map-columns/buildRows';
import {
  ColumnPick,
  MapColumnsDraft,
  MappingRow,
} from '@/utils/map-columns/mapping';

const ids = vi.hoisted(() => ({ next: 0 }));

vi.mock('@dineug/uuid', () => ({ uuid25: () => `id-${++ids.next}` }));

const existing = (columnId: string): ColumnPick => ({
  kind: 'existing',
  columnId,
});

const row = (
  parentColumnId: string,
  pick: ColumnPick | string | null
): MappingRow => ({
  parentColumnId,
  pick: typeof pick === 'string' ? existing(pick) : pick,
});

const create = (
  rows: MappingRow[],
  keyId = 'primaryKey:u',
  relationshipType: number = RelationshipType.OneN
): MapColumnsDraft => ({
  mode: 'create',
  startTableId: 'u',
  endTableId: 'o',
  relationshipType,
  keyId,
  rows,
});

const edit = (rows: MappingRow[], keyId = 'primaryKey:u'): MapColumnsDraft => ({
  mode: 'edit',
  relationshipId: 'r',
  keyId,
  rows,
});

/** users(id int, code char(4)) keyed together, a unique email; orders(a, b, x, y) as text. */
const USERS: MapSeedColumn[] = [
  { id: 'id', name: 'id', dataType: 'int', primaryKey: true },
  { id: 'code', name: 'code', dataType: 'char(4)', primaryKey: true },
  { id: 'email', name: 'email', dataType: 'varchar', unique: true },
];

const ORDERS: MapSeedColumn[] = [
  { id: 'a', name: 'users_id', dataType: 'int' },
  { id: 'b', name: 'users_code', dataType: 'char(4)' },
  { id: 'x', name: 'x', dataType: 'text' },
  { id: 'y', name: 'y', dataType: 'char(4)' },
];

const toWidth = (text: string) => text.length * 10;

describe('mapColumnsAction$', () => {
  const stores: RxStore[] = [];

  function setup(users = USERS, orders = ORDERS) {
    const store = createRxStore({ toWidth, clock: new Clock() });
    stores.push(store);
    seedMapTable(store, 'u', 'users', users);
    seedMapTable(store, 'o', 'orders', orders);
    return store;
  }

  /** Dispatches the generator alone and hands back what it wrote and what it refused. */
  function run(store: RxStore, draft: MapColumnsDraft) {
    vi.advanceTimersByTime(300);
    const onRefuse = vi.fn();
    const historySize = store.history.size;
    const batches: AnyAction[][] = [];
    const unsubscribe = store.subscribe(actions => batches.push(actions));
    ids.next = 0;
    store.dispatchSync(mapColumnsAction$(draft, { onRefuse }));
    unsubscribe();
    vi.advanceTimersByTime(300);

    const written = batches.filter(batch => batch.length);
    return {
      batches: written,
      actions: written.flat(),
      refused: onRefuse.mock.calls.length,
      historyAdded: store.history.size - historySize,
    };
  }

  const relationshipOf = (store: RxStore, id: string) =>
    store.state.collections.relationshipEntities[id];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    while (stores.length) {
      stores.pop()?.destroy();
    }
  });

  describe('creating a relationship', () => {
    it('writes the new columns, the type changes and the relationship in one batch, one version and one undo', () => {
      const store = setup();
      const result = run(
        store,
        create([row('id', 'x'), row('code', { kind: 'new' })])
      );

      expect(result.refused).toBe(0);
      expect(result.batches).toHaveLength(1);
      expect(result.historyAdded).toBe(1);
      expect(new Set(result.actions.map(({ version }) => version)).size).toBe(
        1
      );

      const { tableEntities, tableColumnEntities } = store.state.collections;
      expect(
        result.actions.map(({ type, version: _, ...rest }) => ({
          type,
          ...rest,
        }))
      ).toEqual(
        [
          ...toForeignKeyActions([tableColumnEntities.code], 'o', ['id-1'], {
            startTableName: 'users',
            endColumnNames: ['users_id', 'users_code', 'x', 'y'],
            database: Database.MySQL,
          }),
          changeColumnDataTypeAction({ id: 'x', tableId: 'o', value: 'int' }),
          addRelationshipAction({
            id: 'id-2',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 'u', columnIds: ['id', 'code'] },
            end: { tableId: 'o', columnIds: ['x', 'id-1'] },
          }),
        ].map(({ type, ...rest }) => ({ type, ...rest }))
      );
      expect(tableEntities.o.columnIds).toEqual(['a', 'b', 'x', 'y', 'id-1']);
      expect(tableColumnEntities['id-1'].name).toBe('users_code_2');

      store.undo();

      expect(store.state.doc.relationshipIds).toEqual([]);
      expect(store.state.collections.tableEntities.o.columnIds).toEqual([
        'a',
        'b',
        'x',
        'y',
      ]);
      expect(store.state.collections.tableColumnEntities.x.dataType).toBe(
        'text'
      );
    });

    it('writes the key in column order, the child columns following the same order', () => {
      const store = setup();
      run(store, create([row('code', 'y'), row('id', 'x')]));
      const [id] = store.state.doc.relationshipIds;

      expect(relationshipOf(store, id)).toMatchObject({
        relationshipType: RelationshipType.OneN,
        start: { tableId: 'u', columnIds: ['id', 'code'] },
        end: { tableId: 'o', columnIds: ['x', 'y'] },
      });
    });

    it('writes no type change while the sync is off, nor for a child at its type', () => {
      const store = setup();
      store.dispatchSync(
        changeRelationshipDataTypeSyncAction({ value: false })
      );
      const off = run(store, create([row('email', 'x')], 'unique:email'));

      expect(off.actions.map(({ type }) => type)).toEqual(['relationship.add']);

      const same = run(store, create([row('id', 'a'), row('code', 'b')]));
      expect(same.actions.map(({ type }) => type)).toEqual([
        'relationship.add',
      ]);
    });

    it('writes what the dialog drafted', () => {
      const store = setup();
      let session = openCreateSession(store.state, {
        startTableId: 'u',
        endTableId: 'o',
        relationshipType: RelationshipType.ZeroN,
      });
      session = pickMapColumn(store.state, session, 'code', existing('y'));
      const view = buildMapColumns(store.state, session);
      if (view.closed !== null) throw new Error('the dialog closed');

      run(store, view.draft);
      const [id] = store.state.doc.relationshipIds;

      expect(relationshipOf(store, id)).toMatchObject({
        relationshipType: RelationshipType.ZeroN,
        start: { columnIds: ['id', 'code'] },
        end: { columnIds: ['a', 'y'] },
      });
    });
  });

  describe('editing a relationship', () => {
    it('changes its columns in one batch, one version and one undo, never removing or adding it', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const result = run(store, edit([row('code', 'y'), row('id', 'x')]));

      expect(result.refused).toBe(0);
      expect(result.batches).toHaveLength(1);
      expect(result.historyAdded).toBe(1);
      expect(new Set(result.actions.map(({ version }) => version)).size).toBe(
        1
      );
      expect(result.actions.map(({ type }) => type)).toEqual([
        'column.changeDataType',
        'relationship.changeColumns',
      ]);
      expect(result.actions.at(-1)?.payload).toEqual(
        changeRelationshipColumnsAction({
          id: 'r',
          start: { tableId: 'u', columnIds: ['id', 'code'] },
          end: { tableId: 'o', columnIds: ['x', 'y'] },
        }).payload
      );
      expect(store.state.doc.relationshipIds).toEqual(['r']);
      expect(relationshipOf(store, 'r').end.columnIds).toEqual(['x', 'y']);

      store.undo();

      expect(relationshipOf(store, 'r').end.columnIds).toEqual(['a', 'b']);
      expect(store.state.collections.tableColumnEntities.x.dataType).toBe(
        'text'
      );
    });

    it('keeps the stored order of columns no key covers', () => {
      const store = setup([
        ...USERS,
        { id: 'name', name: 'name', dataType: 'text' },
      ]);
      seedMapRelationship(store, 'r', ['u', ['name', 'id']], ['o', ['x', 'a']]);
      run(store, edit([row('name', 'y'), row('id', 'a')], 'current'));

      expect(relationshipOf(store, 'r')).toMatchObject({
        start: { columnIds: ['name', 'id'] },
        end: { columnIds: ['y', 'a'] },
      });
    });

    it('adds a new column for a row picking one, undone with the change', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const result = run(
        store,
        edit([row('id', 'a'), row('code', { kind: 'new' })])
      );

      expect(result.actions.map(({ type }) => type)).toEqual([
        'column.add',
        'column.changeNotNull',
        'column.changeName',
        'column.changeDataType',
        'column.changeDefault',
        'column.changeComment',
        'relationship.changeColumns',
      ]);
      expect(relationshipOf(store, 'r').end.columnIds).toEqual(['a', 'id-1']);

      store.undo();

      expect(relationshipOf(store, 'r').end.columnIds).toEqual(['a', 'b']);
      expect(store.state.collections.tableEntities.o.columnIds).not.toContain(
        'id-1'
      );
    });
  });

  describe('judged by the state it lands on', () => {
    it('refuses once, writing nothing, when a table it maps between is gone', () => {
      const store = setup();
      store.dispatchSync(removeTableAction({ id: 'o' }));
      const result = run(store, create([row('id', 'a'), row('code', 'b')]));

      expect(result).toMatchObject({
        actions: [],
        refused: 1,
        historyAdded: 0,
      });
    });

    it('refuses once, writing nothing, when the edited relationship or a table it links is gone', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      store.dispatchSync(removeRelationshipAction({ id: 'r' }));

      expect(
        run(store, edit([row('id', 'x'), row('code', 'y')]))
      ).toMatchObject({ actions: [], refused: 1 });

      const other = setup();
      seedMapRelationship(other, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      other.dispatchSync(removeTableAction({ id: 'u' }));
      expect(
        run(other, edit([row('id', 'x'), row('code', 'y')]))
      ).toMatchObject({ actions: [], refused: 1 });
    });

    it('writes nothing and says nothing when the relationship already holds the result', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const draft = edit([row('id', 'x'), row('code', 'y')]);
      store.dispatchSync(
        changeRelationshipColumnsAction({
          id: 'r',
          start: { tableId: 'u', columnIds: ['code', 'id'] },
          end: { tableId: 'o', columnIds: ['y', 'x'] },
        })
      );

      expect(run(store, draft)).toMatchObject({
        actions: [],
        refused: 0,
        historyAdded: 0,
      });
    });

    it('writes nothing and says nothing when another made the same link first, of any kind', () => {
      const store = setup();
      seedMapRelationship(
        store,
        'peer',
        ['u', ['id', 'code']],
        ['o', ['x', 'y']],
        RelationshipType.ZeroOne
      );

      expect(
        run(store, create([row('id', 'x'), row('code', 'y')]))
      ).toMatchObject({ actions: [], refused: 0 });
      expect(store.state.doc.relationshipIds).toEqual(['peer']);
    });

    it('refuses a link over the columns another relationship pairs the other way', () => {
      const store = setup();
      seedMapRelationship(
        store,
        'peer',
        ['u', ['id', 'code']],
        ['o', ['y', 'x']]
      );

      expect(
        run(store, create([row('id', 'x'), row('code', 'y')]))
      ).toMatchObject({ actions: [], refused: 1 });
    });

    it('refuses a picked child removed before it lands', () => {
      const store = setup();
      const draft = create([row('id', 'x'), row('code', 'y')]);
      store.dispatchSync(removeColumnAction({ id: 'y', tableId: 'o' }));

      expect(run(store, draft)).toMatchObject({ actions: [], refused: 1 });
    });

    it('refuses rows the key no longer matches though its id stands, gaining or losing a column', () => {
      const store = setup();
      const draft = create([row('id', 'x'), row('code', 'y')]);
      addMapColumn(store, 'u', { id: 'tenant', primaryKey: true });

      expect(run(store, draft)).toMatchObject({ actions: [], refused: 1 });

      const other = setup();
      other.dispatchSync(
        changeColumnPrimaryKeyAction({ id: 'code', tableId: 'u', value: false })
      );
      expect(run(other, draft)).toMatchObject({ actions: [], refused: 1 });
    });

    it('refuses a link of a table whose every row references its own column', () => {
      const store = setup();
      const draft: MapColumnsDraft = {
        mode: 'create',
        startTableId: 'u',
        endTableId: 'u',
        relationshipType: RelationshipType.OneN,
        keyId: 'primaryKey:u',
        rows: [row('id', 'id'), row('code', 'code')],
      };

      expect(run(store, draft)).toMatchObject({ actions: [], refused: 1 });
    });

    it('writes the key in its new column order when only the order changed', () => {
      const store = setup();
      const draft = create([row('id', 'x'), row('code', 'y')]);
      store.dispatchSync(
        moveColumnAction({ id: 'code', tableId: 'u', targetId: 'id' })
      );

      expect(run(store, draft)).toMatchObject({ refused: 0 });
      const [id] = store.state.doc.relationshipIds;
      expect(relationshipOf(store, id)).toMatchObject({
        start: { columnIds: ['code', 'id'] },
        end: { columnIds: ['y', 'x'] },
      });
    });

    it('gives a serial key child the integer its database stores', () => {
      const store = setup([
        { id: 'id', name: 'id', dataType: 'serial', primaryKey: true },
      ]);
      store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
      run(store, create([row('id', 'x')]));

      expect(store.state.collections.tableColumnEntities.x.dataType).toBe(
        'integer'
      );
      expect(store.state.collections.tableColumnEntities.id.dataType).toBe(
        'serial'
      );
    });
  });
});
