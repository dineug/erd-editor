import { describe, expect, it } from 'vite-plus/test';

import {
  createMapStore,
  MapSeedColumn,
  seedMapRelationship,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { Database } from '@/constants/schema';
import {
  changeDatabaseAction,
  changeRelationshipDataTypeSyncAction,
} from '@/engine/modules/settings/atom.actions';
import { changeColumnDataTypeAction } from '@/engine/modules/table-column/atom.actions';
import {
  getTypeNote,
  toAlignTypeActions,
} from '@/utils/map-columns/alignTypes';

const type = (id: string, tableId: string, value: string) =>
  changeColumnDataTypeAction({ id, tableId, value });

function setup(parent: MapSeedColumn[], child: MapSeedColumn[]) {
  const store = createMapStore();
  seedMapTable(store, 'p', 'users', parent);
  seedMapTable(store, 'c', 'orders', child);
  return store;
}

const link = (start: string[], end: string[], newColumnIds: string[] = []) => ({
  start: { tableId: 'p', columnIds: start },
  end: { tableId: 'c', columnIds: end },
  newColumnIds,
});

describe('toAlignTypeActions', () => {
  it('gives each existing child its parent type while the sync is on', () => {
    const store = setup(
      [
        { id: 'id', dataType: 'int' },
        { id: 'code', dataType: 'char(4)' },
      ],
      [
        { id: 'a', dataType: 'varchar' },
        { id: 'b', dataType: 'text' },
      ]
    );

    expect(
      toAlignTypeActions(store.state, link(['id', 'code'], ['a', 'b']))
    ).toEqual([type('a', 'c', 'int'), type('b', 'c', 'char(4)')]);
  });

  it('changes nothing while the sync is off', () => {
    const store = setup([{ id: 'id', dataType: 'int' }], [{ id: 'a' }]);
    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: false }));

    expect(toAlignTypeActions(store.state, link(['id'], ['a']))).toEqual([]);
  });

  it('leaves a child alone whose parent has no type, and one already at its type', () => {
    const store = setup(
      [
        { id: 'id', dataType: '  ' },
        { id: 'code', dataType: 'int' },
      ],
      [
        { id: 'a', dataType: 'uuid' },
        { id: 'b', dataType: 'int' },
      ]
    );

    expect(
      toAlignTypeActions(store.state, link(['id', 'code'], ['a', 'b']))
    ).toEqual([]);
  });

  it('gives the child of a serial key the integer the key stores', () => {
    const store = setup([{ id: 'id', dataType: 'serial' }], [{ id: 'a' }]);

    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
    expect(toAlignTypeActions(store.state, link(['id'], ['a']))).toEqual([
      type('a', 'c', 'integer'),
    ]);

    store.dispatchSync(changeDatabaseAction({ value: Database.MySQL }));
    expect(toAlignTypeActions(store.state, link(['id'], ['a']))).toEqual([
      type('a', 'c', 'bigint unsigned'),
    ]);
  });

  it('writes no new column the batch adds, which already takes its type', () => {
    const store = setup(
      [
        { id: 'id', dataType: 'int' },
        { id: 'code', dataType: 'int' },
      ],
      [{ id: 'a', dataType: 'text' }]
    );

    expect(
      toAlignTypeActions(store.state, link(['id', 'code'], ['a', 'n'], ['n']))
    ).toEqual([type('a', 'c', 'int')]);
    expect(toAlignTypeActions(store.state, link(['id'], ['n'], ['n']))).toEqual(
      []
    );
  });

  it('carries the type on to the child key, its other parent and its own children', () => {
    const store = setup(
      [{ id: 'id', dataType: 'serial' }],
      [{ id: 'a', dataType: 'text' }]
    );
    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
    seedMapTable(store, 't', 'tenants', [{ id: 'tid', dataType: 'text' }]);
    seedMapTable(store, 'g', 'lines', [{ id: 'ga', dataType: 'text' }]);
    seedMapRelationship(store, 'tenant', ['t', ['tid']], ['c', ['a']]);
    seedMapRelationship(store, 'line', ['c', ['a']], ['g', ['ga']]);

    expect(toAlignTypeActions(store.state, link(['id'], ['a']))).toEqual(
      expect.arrayContaining([
        type('a', 'c', 'integer'),
        type('tid', 't', 'integer'),
        type('ga', 'g', 'integer'),
      ])
    );
    expect(toAlignTypeActions(store.state, link(['id'], ['a']))).toHaveLength(
      3
    );
  });

  it('follows the edited relationship by its new ends, not the ones it leaves', () => {
    const store = setup(
      [{ id: 'id', dataType: 'int' }],
      [
        { id: 'old', dataType: 'text' },
        { id: 'a', dataType: 'varchar' },
      ]
    );
    seedMapRelationship(store, 'r', ['p', ['id']], ['c', ['old']]);

    expect(
      toAlignTypeActions(store.state, {
        relationshipId: 'r',
        ...link(['id'], ['a']),
      })
    ).toEqual([type('a', 'c', 'int')]);
    expect(toAlignTypeActions(store.state, link(['id'], ['a']))).toEqual([
      type('a', 'c', 'int'),
      type('old', 'c', 'int'),
    ]);
  });
});

describe('getTypeNote', () => {
  const column = (dataType: string) =>
    ({ dataType }) as Parameters<typeof getTypeNote>[1];

  it('says nothing of a child at the type its parent gives a foreign key', () => {
    const store = createMapStore();
    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));

    expect(getTypeNote(store.state, column('int'), column('int'))).toBeNull();
    expect(
      getTypeNote(store.state, column('serial'), column('integer'))
    ).toBeNull();
  });

  it('names the type the child becomes while the sync is on', () => {
    const store = createMapStore();
    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));

    expect(getTypeNote(store.state, column('serial'), column('text'))).toEqual({
      kind: 'becomes',
      dataType: 'integer',
    });
  });

  it('names both types while the sync is off, or when the parent has none', () => {
    const store = createMapStore();

    expect(getTypeNote(store.state, column(''), column('text'))).toEqual({
      kind: 'differ',
      parentType: '',
      childType: 'text',
    });

    store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: false }));
    expect(getTypeNote(store.state, column('int'), column('text'))).toEqual({
      kind: 'differ',
      parentType: 'int',
      childType: 'text',
    });
  });
});
