import { describe, expect, it } from 'vite-plus/test';

import {
  addMapColumn,
  createMapStore,
  MapSeedColumn,
  seedMapRelationship,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { RelationshipType } from '@/constants/schema';
import {
  changeRelationshipColumnsAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import {
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  buildMapColumns,
  changeMapColumnsKey,
  MapColumnsSession,
  MapColumnsView,
  openCreateSession,
  openEditSession,
  pickMapColumn,
} from '@/utils/map-columns/buildRows';
import { CURRENT_KEY_ID } from '@/utils/map-columns/candidateKeys';
import { ColumnPick } from '@/utils/map-columns/mapping';

type MapStore = ReturnType<typeof createMapStore>;

const existing = (columnId: string): ColumnPick => ({
  kind: 'existing',
  columnId,
});

const NEW: ColumnPick = { kind: 'new' };

function viewOf(store: MapStore, session: MapColumnsSession): MapColumnsView {
  const view = buildMapColumns(store.state, session);
  if (view.closed !== null) throw new Error('the dialog closed');
  return view;
}

/** Each row as parent column and picked child, null for none and NEW for a new one. */
const pairsOf = ({ rows }: MapColumnsView) =>
  rows.map(({ parentColumnId, pick }) => [
    parentColumnId,
    pick?.kind === 'existing' ? pick.columnId : pick && 'NEW',
  ]);

/** users: id, name and code with id and code the primary key, email unique. */
const USERS: MapSeedColumn[] = [
  { id: 'id', name: 'id', primaryKey: true },
  { id: 'name', name: 'name' },
  { id: 'code', name: 'code', primaryKey: true },
  { id: 'email', name: 'email', unique: true },
];

/** orders: two columns named for the users key, and two more. */
const ORDERS: MapSeedColumn[] = [
  { id: 'a', name: 'users_id' },
  { id: 'b', name: 'users_code' },
  { id: 'x', name: 'x' },
  { id: 'y', name: 'y' },
];

function setup(users = USERS, orders = ORDERS) {
  const store = createMapStore();
  seedMapTable(store, 'u', 'users', users);
  seedMapTable(store, 'o', 'orders', orders);
  return store;
}

const createSession = (store: MapStore) =>
  openCreateSession(store.state, {
    startTableId: 'u',
    endTableId: 'o',
    relationshipType: RelationshipType.OneN,
  });

/** Changes a relationship's columns at a version of its own, as a peer would. */
function remap(
  store: MapStore,
  start: string[],
  end: string[],
  version: number,
  id = 'r'
) {
  const { start: from, end: to } =
    store.state.collections.relationshipEntities[id];
  store.dispatchSync({
    ...changeRelationshipColumnsAction({
      id,
      start: { tableId: from.tableId, columnIds: start },
      end: { tableId: to.tableId, columnIds: end },
    }),
    version,
  });
}

describe('a dialog creating a relationship', () => {
  it('opens on the primary key in column order with the one column each name points at', () => {
    const store = setup();
    const view = viewOf(store, createSession(store));

    expect(view.keyId).toBe('primaryKey:u');
    expect(pairsOf(view)).toEqual([
      ['id', 'a'],
      ['code', 'b'],
    ]);
    expect(view.showReferences).toBe(true);
    expect(view.keys.map(({ id }) => id)).toEqual([
      'primaryKey:u',
      'unique:email',
    ]);
    expect(view.issues).toEqual({ rows: [null, null], set: [] });
    expect(view.canConfirm).toBe(true);
    expect(view.draft).toEqual({
      mode: 'create',
      startTableId: 'u',
      endTableId: 'o',
      relationshipType: RelationshipType.OneN,
      keyId: 'primaryKey:u',
      rows: [
        { parentColumnId: 'id', pick: existing('a') },
        { parentColumnId: 'code', pick: existing('b') },
      ],
    });
    expect(view.parentTable.id).toBe('u');
    expect(view.childTable.id).toBe('o');
    expect(view.notice).toBeNull();
    expect(view.changedRemotely).toBe(false);
  });

  it('hides References with one key to pick, a unique column under a one column key included', () => {
    const store = setup(
      [{ id: 'id', name: 'id', primaryKey: true, unique: true }],
      [{ id: 'a', name: 'other' }]
    );
    const view = viewOf(store, createSession(store));

    expect(view.showReferences).toBe(false);
    expect(pairsOf(view)).toEqual([['id', null]]);
    expect(view.issues.rows).toEqual(['unpicked']);
    expect(view.canConfirm).toBe(false);
  });

  it('opens on the one unique column of a table without a primary key', () => {
    const store = setup(
      [{ id: 'vin', name: 'VIN', unique: true }],
      [{ id: 'a', name: 'vin' }]
    );
    const view = viewOf(store, createSession(store));

    expect(view.showReferences).toBe(false);
    expect(view.keyId).toBe('unique:vin');
    expect(pairsOf(view)).toEqual([['vin', 'a']]);
  });

  it('shows no rows and no key on a table without one', () => {
    const store = setup([{ id: 'name' }]);
    const session = createSession(store);
    const view = viewOf(store, session);

    expect(session.keyId).toBeNull();
    expect(view.keyId).toBeNull();
    expect(view.rows).toEqual([]);
    expect(view.issues.set).toEqual(['noKey']);
    expect(view.canConfirm).toBe(false);
  });

  it('rebuilds the rows on another key, keeping the child a parent column had and filling the rest', () => {
    const store = setup(
      [
        { id: 'id', name: 'id', primaryKey: true },
        { id: 'code', name: 'code', primaryKey: true, unique: true },
      ],
      [
        { id: 'a', name: 'users_id' },
        { id: 'x', name: 'x' },
        { id: 'c', name: 'code' },
      ]
    );
    let session = createSession(store);
    session = pickMapColumn(store.state, session, 'code', existing('x'));
    session = changeMapColumnsKey(store.state, session, 'unique:code');

    expect(pairsOf(viewOf(store, session))).toEqual([['code', 'x']]);

    session = pickMapColumn(store.state, session, 'code', null);
    session = changeMapColumnsKey(store.state, session, 'primaryKey:u');
    expect(pairsOf(viewOf(store, session))).toEqual([
      ['id', 'a'],
      ['code', null],
    ]);

    session = changeMapColumnsKey(store.state, session, 'unique:code');
    expect(pairsOf(viewOf(store, session))).toEqual([['code', 'c']]);
  });

  it('ignores a key it does not offer', () => {
    const store = setup();
    const session = createSession(store);

    expect(changeMapColumnsKey(store.state, session, 'unique:name')).toBe(
      session
    );
  });

  it('keeps a pick or an emptied row the reader set', () => {
    const store = setup();
    let session = createSession(store);
    session = pickMapColumn(store.state, session, 'id', existing('x'));
    session = pickMapColumn(store.state, session, 'code', null);
    const view = viewOf(store, session);

    expect(pairsOf(view)).toEqual([
      ['id', 'x'],
      ['code', null],
    ]);
    expect(view.issues.rows).toEqual([null, 'unpicked']);
  });

  it('names a new foreign key column as the draw would, beside the other new ones', () => {
    const store = setup(USERS, [{ id: 'a', name: 'users_id' }]);
    let session = createSession(store);
    session = pickMapColumn(store.state, session, 'id', NEW);
    let view = viewOf(store, session);

    expect(view.rows.map(({ newColumnName }) => newColumnName)).toEqual([
      'users_id_2',
      'users_code',
    ]);

    session = pickMapColumn(store.state, session, 'code', NEW);
    view = viewOf(store, session);
    expect(view.rows.map(({ newColumnName }) => newColumnName)).toEqual([
      'users_id_2',
      'users_code',
    ]);
    expect(view.canConfirm).toBe(true);
  });

  describe('while others edit the diagram', () => {
    it('empties a row whose picked child is removed', () => {
      const store = setup();
      const session = createSession(store);
      store.dispatchSync(removeColumnAction({ id: 'b', tableId: 'o' }));
      const view = viewOf(store, session);

      expect(pairsOf(view)).toEqual([
        ['id', 'a'],
        ['code', null],
      ]);
      expect(view.rows[1].removedChild).toBe(false);
      expect(view.canConfirm).toBe(false);
    });

    it('rebuilds the rows by parent column when the key gains or loses one, filling none', () => {
      const store = setup();
      const session = createSession(store);
      addMapColumn(store, 'u', {
        id: 'tenant',
        name: 'tenant',
        primaryKey: true,
      });
      addMapColumn(store, 'o', { id: 't', name: 'users_tenant' });

      expect(pairsOf(viewOf(store, session))).toEqual([
        ['id', 'a'],
        ['code', 'b'],
        ['tenant', null],
      ]);

      store.dispatchSync(
        changeColumnPrimaryKeyAction({ id: 'id', tableId: 'u', value: false })
      );
      expect(pairsOf(viewOf(store, session))).toEqual([
        ['code', 'b'],
        ['tenant', null],
      ]);
    });

    it('falls back to the first key when the one picked goes, and to none at last', () => {
      const store = setup();
      const session = changeMapColumnsKey(
        store.state,
        createSession(store),
        'unique:email'
      );
      store.dispatchSync(
        changeColumnUniqueAction({ id: 'email', tableId: 'u', value: false })
      );

      expect(viewOf(store, session).keyId).toBe('primaryKey:u');

      for (const id of ['id', 'code']) {
        store.dispatchSync(
          changeColumnPrimaryKeyAction({ id, tableId: 'u', value: false })
        );
      }
      const view = viewOf(store, session);
      expect(view.keyId).toBeNull();
      expect(view.rows).toEqual([]);
      expect(view.issues.set).toEqual(['noKey']);
    });

    it('turns Map off once another relationship links the same columns', () => {
      const store = setup();
      const session = createSession(store);
      seedMapRelationship(
        store,
        'peer',
        ['u', ['id', 'code']],
        ['o', ['a', 'b']]
      );
      const view = viewOf(store, session);

      expect(view.issues.set).toEqual(['duplicate']);
      expect(view.canConfirm).toBe(false);
    });

    it('closes once either table leaves the document', () => {
      const store = setup();
      const session = createSession(store);
      store.dispatchSync(removeTableAction({ id: 'o' }));

      expect(buildMapColumns(store.state, session)).toEqual({
        closed: { reason: 'tableRemoved', tableId: 'o' },
      });

      store.dispatchSync(removeTableAction({ id: 'u' }));
      expect(buildMapColumns(store.state, session)).toEqual({
        closed: { reason: 'tableRemoved', tableId: 'u' },
      });
    });

    it('opens with no key or picks on a table already gone, and keys nothing on a closed dialog', () => {
      const store = setup();
      store.dispatchSync(removeTableAction({ id: 'o' }));
      const session = createSession(store);

      expect(session).toMatchObject({ keyId: null, picks: {} });
      expect(changeMapColumnsKey(store.state, session, 'primaryKey:u')).toBe(
        session
      );
      expect(
        pickMapColumn(store.state, session, 'id', existing('a'))
      ).toMatchObject({ keyId: null, picks: { id: existing('a') } });
    });
  });
});

describe('a dialog editing a relationship', () => {
  it('opens on the key the stored columns cover, in key order, whatever their stored order', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['code', 'id']], ['o', ['b', 'a']]);
    const session = openEditSession(store.state, 'r');
    const view = viewOf(store, session);

    expect(session).toMatchObject({
      touched: false,
      keyId: 'primaryKey:u',
      base: {
        startColumnIds: ['code', 'id'],
        endColumnIds: ['b', 'a'],
        keyId: 'primaryKey:u',
        keys: {
          'primaryKey:u': ['id', 'code'],
          'unique:email': ['email'],
        },
      },
    });
    expect(view.keyId).toBe('primaryKey:u');
    expect(pairsOf(view)).toEqual([
      ['id', 'a'],
      ['code', 'b'],
    ]);
    expect(view.relationshipType).toBe(RelationshipType.OneN);
    expect(view.notice).toBeNull();
    expect(view.issues.set).toEqual(['unchanged']);
    expect(view.canConfirm).toBe(false);
  });

  it('says the stored columns are no key only while no row is broken', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name']], ['o', ['x']]);
    const session = openEditSession(store.state, 'r');
    store.dispatchSync(removeColumnAction({ id: 'x', tableId: 'o' }));
    const view = viewOf(store, session);

    expect(view.keyId).toBe(CURRENT_KEY_ID);
    expect(view.rows[0].removedChild).toBe(true);
    expect(view.notice).toBeNull();
    expect(view.canConfirm).toBe(false);

    const repaired = viewOf(
      store,
      pickMapColumn(store.state, session, 'name', existing('y'))
    );
    expect(repaired.notice).toBe('notAKey');
    expect(repaired.canConfirm).toBe(true);
  });

  it('opens stored columns no key covers as they are, beside the keys', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name']], ['o', ['x']]);
    const view = viewOf(store, openEditSession(store.state, 'r'));

    expect(view.keyId).toBe(CURRENT_KEY_ID);
    expect(view.keys.map(({ id }) => id)).toEqual([
      'primaryKey:u',
      'unique:email',
      CURRENT_KEY_ID,
    ]);
    expect(view.showReferences).toBe(true);
    expect(pairsOf(view)).toEqual([['name', 'x']]);
    expect(view.notice).toBe('notAKey');
    expect(view.issues).toEqual({ rows: [null], set: ['unchanged'] });

    const session = pickMapColumn(
      store.state,
      openEditSession(store.state, 'r'),
      'name',
      existing('y')
    );
    expect(viewOf(store, session).canConfirm).toBe(true);
  });

  it('marks invalid each place two lists of different lengths cannot pair', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a']]);
    const view = viewOf(store, openEditSession(store.state, 'r'));

    expect(view.keyId).toBe(CURRENT_KEY_ID);
    expect(view.rows.map(({ invalid }) => !!invalid)).toEqual([false, true]);
    expect(view.notice).toBe('fixMapping');
    expect(view.issues.rows).toEqual([null, 'invalid']);
    expect(view.canConfirm).toBe(false);

    remap(store, ['id'], ['a', 'b'], 1);
    expect(viewOf(store, openEditSession(store.state, 'r')).rows).toMatchObject(
      [
        { parentColumnId: 'id', pick: existing('a') },
        { parentColumnId: null, pick: existing('b'), invalid: true },
      ]
    );
  });

  it('marks invalid every place holding an id its list repeats', () => {
    const store = setup();
    seedMapRelationship(
      store,
      'r',
      ['u', ['id', 'id', 'code']],
      ['o', ['a', 'b', 'x']]
    );
    seedMapRelationship(
      store,
      'r2',
      ['u', ['id', 'code', 'email']],
      ['o', ['a', 'a', 'x']]
    );

    expect(
      viewOf(store, openEditSession(store.state, 'r')).rows.map(
        ({ invalid }) => !!invalid
      )
    ).toEqual([true, true, false]);
    expect(
      viewOf(store, openEditSession(store.state, 'r2')).rows.map(
        ({ invalid }) => !!invalid
      )
    ).toEqual([true, true, false]);
  });

  it('marks a removed parent column, which only a key mends', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name']], ['o', ['x']]);
    store.dispatchSync(removeColumnAction({ id: 'name', tableId: 'u' }));
    const view = viewOf(store, openEditSession(store.state, 'r'));

    expect(view.rows[0]).toMatchObject({
      parentColumnId: 'name',
      removedParent: true,
      removedChild: false,
    });
    expect(view.notice).toBe('fixMapping');
    expect(view.issues.rows).toEqual(['removedParent']);
  });

  it('starts a key row whose stored child is removed on that column, until another is picked', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
    store.dispatchSync(removeColumnAction({ id: 'b', tableId: 'o' }));
    let session: MapColumnsSession = openEditSession(store.state, 'r');
    let view = viewOf(store, session);

    expect(view.keyId).toBe('primaryKey:u');
    expect(view.rows[1]).toMatchObject({
      pick: existing('b'),
      removedChild: true,
    });
    expect(view.issues.rows).toEqual([null, 'removedChild']);

    session = pickMapColumn(store.state, session, 'code', existing('x'));
    view = viewOf(store, session);
    expect(pairsOf(view)).toEqual([
      ['id', 'a'],
      ['code', 'x'],
    ]);
    expect(view.canConfirm).toBe(true);
  });

  it('carries the stored pairs a key can keep once one is picked over broken ones', () => {
    const store = setup();
    seedMapRelationship(
      store,
      'r',
      ['u', ['id', 'id', 'code']],
      ['o', ['x', 'y', 'b']]
    );
    let session: MapColumnsSession = openEditSession(store.state, 'r');
    session = changeMapColumnsKey(store.state, session, 'primaryKey:u');
    const view = viewOf(store, session);

    expect(view.keyId).toBe('primaryKey:u');
    expect(pairsOf(view)).toEqual([
      ['id', 'a'],
      ['code', 'b'],
    ]);
    expect(view.canConfirm).toBe(true);
  });

  it('empties a key row whose stored child is gone once the key is picked, filling those a name points at', () => {
    const store = setup(USERS, [
      { id: 'x', name: 'x' },
      { id: 'y', name: 'y' },
      { id: 'b', name: 'users_code' },
    ]);
    seedMapRelationship(store, 'r', ['u', ['id', 'name']], ['o', ['x', 'y']]);
    store.dispatchSync(removeColumnAction({ id: 'x', tableId: 'o' }));
    let session: MapColumnsSession = openEditSession(store.state, 'r');
    session = changeMapColumnsKey(store.state, session, 'primaryKey:u');

    expect(session).toEqual(
      expect.objectContaining({
        touched: true,
        keyId: 'primaryKey:u',
        picks: { id: null, code: existing('b') },
      })
    );
    expect(pairsOf(viewOf(store, session))).toEqual([
      ['id', null],
      ['code', 'b'],
    ]);
  });

  it('keeps the rows the reader set across a return to the stored columns', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name', 'id']], ['o', ['x', 'y']]);
    let session: MapColumnsSession = openEditSession(store.state, 'r');
    session = pickMapColumn(store.state, session, 'id', existing('a'));
    session = changeMapColumnsKey(store.state, session, 'primaryKey:u');
    expect(pairsOf(viewOf(store, session))).toEqual([
      ['id', 'a'],
      ['code', 'b'],
    ]);

    session = changeMapColumnsKey(store.state, session, CURRENT_KEY_ID);
    expect(pairsOf(viewOf(store, session))).toEqual([
      ['name', 'x'],
      ['id', 'a'],
    ]);
  });

  it('shows a stored child gone as removed again on a return to the stored columns', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name', 'id']], ['o', ['x', 'y']]);
    store.dispatchSync(removeColumnAction({ id: 'y', tableId: 'o' }));
    let session: MapColumnsSession = openEditSession(store.state, 'r');
    session = changeMapColumnsKey(store.state, session, 'unique:email');

    expect(pairsOf(viewOf(store, session))).toEqual([['email', null]]);

    session = changeMapColumnsKey(store.state, session, CURRENT_KEY_ID);
    const view = viewOf(store, session);
    expect(pairsOf(view)).toEqual([
      ['name', 'x'],
      ['id', 'y'],
    ]);
    expect(view.rows[1].removedChild).toBe(true);
  });

  it('carries the child a key showed for a parent column back to the stored columns', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name', 'id']], ['o', ['x', 'y']]);
    store.dispatchSync(removeColumnAction({ id: 'y', tableId: 'o' }));
    let session: MapColumnsSession = openEditSession(store.state, 'r');
    session = changeMapColumnsKey(store.state, session, 'primaryKey:u');
    session = changeMapColumnsKey(store.state, session, CURRENT_KEY_ID);

    expect(pairsOf(viewOf(store, session))).toEqual([
      ['name', 'x'],
      ['id', 'a'],
    ]);
  });

  describe('on a parent with no key', () => {
    it('hides References, warns of no key and saves a child mended alone', () => {
      const store = setup([{ id: 'name' }, { id: 'kind' }]);
      seedMapRelationship(store, 'r', ['u', ['name']], ['o', ['x']]);
      store.dispatchSync(removeColumnAction({ id: 'x', tableId: 'o' }));
      let session: MapColumnsSession = openEditSession(store.state, 'r');
      let view = viewOf(store, session);

      expect(view.keys.map(({ id }) => id)).toEqual([CURRENT_KEY_ID]);
      expect(view.showReferences).toBe(false);
      expect(view.notice).toBe('noKey');
      expect(view.rows[0].removedChild).toBe(true);
      expect(view.canConfirm).toBe(false);

      session = pickMapColumn(store.state, session, 'name', existing('y'));
      view = viewOf(store, session);
      expect(view.canConfirm).toBe(true);
    });

    it('asks for a key where a broken place or a removed parent needs one', () => {
      const store = setup([{ id: 'name' }, { id: 'kind' }]);
      seedMapRelationship(store, 'r', ['u', ['name', 'kind']], ['o', ['x']]);
      const view = viewOf(store, openEditSession(store.state, 'r'));

      expect(view.notice).toBe('addKeyToFix');
      expect(view.canConfirm).toBe(false);
    });
  });

  describe('while others edit the diagram', () => {
    it('follows the relationship as it stands until the reader changes a row', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = openEditSession(store.state, 'r');
      remap(store, ['id', 'code'], ['x', 'y'], 1);
      const view = viewOf(store, session);

      expect(pairsOf(view)).toEqual([
        ['id', 'x'],
        ['code', 'y'],
      ]);
      expect(view.changedRemotely).toBe(true);
    });

    it('keeps the key and the rows the reader set, the others following the relationship', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = pickMapColumn(
        store.state,
        openEditSession(store.state, 'r'),
        'id',
        existing('x')
      );
      remap(store, ['id', 'code'], ['y', 'a'], 1);

      expect(pairsOf(viewOf(store, session))).toEqual([
        ['id', 'x'],
        ['code', 'a'],
      ]);

      remap(store, ['email'], ['b'], 2);
      expect(pairsOf(viewOf(store, session))).toEqual([
        ['id', 'x'],
        ['code', null],
      ]);
    });

    it('empties a row following the relationship onto a child a row the reader set holds', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = pickMapColumn(
        store.state,
        openEditSession(store.state, 'r'),
        'id',
        existing('x')
      );
      remap(store, ['id', 'code'], ['a', 'x'], 1);

      expect(pairsOf(viewOf(store, session))).toEqual([
        ['id', 'x'],
        ['code', null],
      ]);
    });

    it('marks removed a picked child gone, set by the reader or not', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = pickMapColumn(
        store.state,
        openEditSession(store.state, 'r'),
        'id',
        existing('x')
      );
      store.dispatchSync(
        removeColumnAction({ id: 'x', tableId: 'o' }),
        removeColumnAction({ id: 'b', tableId: 'o' })
      );
      const view = viewOf(store, session);

      expect(view.rows.map(({ removedChild }) => removedChild)).toEqual([
        true,
        true,
      ]);
      expect(view.issues.rows).toEqual(['removedChild', 'removedChild']);
    });

    it('takes the stored columns as they are once the key they covered gains a column, untouched', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = openEditSession(store.state, 'r');
      addMapColumn(store, 'u', { id: 'tenant', primaryKey: true });
      const view = viewOf(store, session);

      expect(view.keyId).toBe(CURRENT_KEY_ID);
      expect(pairsOf(view)).toEqual([
        ['id', 'a'],
        ['code', 'b'],
      ]);
      expect(view.notice).toBe('notAKey');
      expect(view.changedRemotely).toBe(true);
    });

    it('rebuilds the picked key on its columns now once it gains or loses one, touched', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = pickMapColumn(
        store.state,
        openEditSession(store.state, 'r'),
        'code',
        existing('y')
      );
      addMapColumn(store, 'u', { id: 'tenant', primaryKey: true });
      let view = viewOf(store, session);

      expect(view.keyId).toBe('primaryKey:u');
      expect(pairsOf(view)).toEqual([
        ['id', 'a'],
        ['code', 'y'],
        ['tenant', null],
      ]);
      expect(view.changedRemotely).toBe(true);

      store.dispatchSync(
        changeColumnPrimaryKeyAction({ id: 'id', tableId: 'u', value: false })
      );
      view = viewOf(store, session);
      expect(pairsOf(view)).toEqual([
        ['code', 'y'],
        ['tenant', null],
      ]);
    });

    it('falls back from a picked key that goes to the stored columns, or the key they cover', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = changeMapColumnsKey(
        store.state,
        openEditSession(store.state, 'r'),
        'unique:email'
      );
      store.dispatchSync(
        changeColumnUniqueAction({ id: 'email', tableId: 'u', value: false })
      );
      const view = viewOf(store, session);

      expect(session.keyId).toBe('unique:email');
      expect(view.keyId).toBe('primaryKey:u');
      expect(view.changedRemotely).toBe(true);

      remap(store, ['name'], ['a'], 1);
      expect(viewOf(store, session).keyId).toBe(CURRENT_KEY_ID);
    });

    it('stays quiet over a change of kind or of a key it never picked', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      const session = openEditSession(store.state, 'r');
      store.dispatchSync(
        changeRelationshipTypeAction({
          id: 'r',
          value: RelationshipType.ZeroN,
        }),
        changeColumnUniqueAction({ id: 'email', tableId: 'u', value: false })
      );
      const view = viewOf(store, session);

      expect(view.relationshipType).toBe(RelationshipType.ZeroN);
      expect(view.changedRemotely).toBe(false);
    });

    it('closes once the relationship, or a table it links, leaves the document', () => {
      const store = setup();
      seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
      seedMapRelationship(store, 'r2', ['u', ['email']], ['o', ['x']]);
      const session = openEditSession(store.state, 'r');
      const other = openEditSession(store.state, 'r2');
      store.dispatchSync(removeRelationshipAction({ id: 'r' }));

      expect(buildMapColumns(store.state, session)).toEqual({
        closed: { reason: 'relationshipRemoved' },
      });

      store.dispatchSync(removeTableAction({ id: 'o' }));
      expect(buildMapColumns(store.state, other)).toEqual({
        closed: { reason: 'tableRemoved', tableId: 'o' },
      });
    });

    it('opens on a relationship it cannot find as one already closed', () => {
      const store = setup();
      const session = openEditSession(store.state, 'ghost');

      expect(session.base).toEqual({
        startColumnIds: [],
        endColumnIds: [],
        keyId: CURRENT_KEY_ID,
        keys: {},
      });
      expect(buildMapColumns(store.state, session)).toEqual({
        closed: { reason: 'relationshipRemoved' },
      });
      expect(
        pickMapColumn(store.state, session, 'id', existing('a'))
      ).toMatchObject({ touched: false, picks: { id: existing('a') } });
    });
  });
});
