import { describe, expect, it } from 'vite-plus/test';

import {
  addMapColumn,
  createMapStore,
  seedMapRelationship,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { RelationshipType } from '@/constants/schema';
import { removeRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import {
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { CURRENT_KEY_ID } from '@/utils/map-columns/candidateKeys';
import {
  ColumnPick,
  MapColumnsDraft,
  MappingRow,
} from '@/utils/map-columns/mapping';
import {
  getDraftEnds,
  hasMappingIssues,
  hasMappingTargets,
  isSameResult,
  validateMapping,
} from '@/utils/map-columns/validate';

const existing = (columnId: string): ColumnPick => ({
  kind: 'existing',
  columnId,
});

const row = (
  parentColumnId: string | null,
  pick: ColumnPick | string | null
): MappingRow => ({
  parentColumnId,
  pick: typeof pick === 'string' ? existing(pick) : pick,
});

const create = (
  rows: MappingRow[],
  keyId: string | null = 'primaryKey:u',
  startTableId = 'u',
  endTableId = 'o'
): MapColumnsDraft => ({
  mode: 'create',
  startTableId,
  endTableId,
  relationshipType: RelationshipType.OneN,
  keyId,
  rows,
});

const edit = (
  rows: MappingRow[],
  keyId = 'primaryKey:u',
  relationshipId = 'r'
): MapColumnsDraft => ({ mode: 'edit', relationshipId, keyId, rows });

/** users(id, code) keyed together with a unique email, and orders(a, b, c) referencing nothing yet. */
function setup() {
  const store = createMapStore();
  seedMapTable(store, 'u', 'users', [
    { id: 'id', primaryKey: true },
    { id: 'code', primaryKey: true },
    { id: 'email', unique: true },
    { id: 'name' },
  ]);
  seedMapTable(store, 'o', 'orders', [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  return store;
}

describe('validateMapping rows', () => {
  it('passes rows each on a live parent and a live or new child', () => {
    const store = setup();

    expect(
      validateMapping(
        store.state,
        create([row('id', 'a'), row('code', { kind: 'new' })])
      )
    ).toEqual({ rows: [null, null], set: [] });
  });

  it('reports a row with no child picked', () => {
    const store = setup();

    expect(
      validateMapping(store.state, create([row('id', 'a'), row('code', null)]))
        .rows
    ).toEqual([null, 'unpicked']);
  });

  it('reports a picked child gone from its table', () => {
    const store = setup();
    store.dispatchSync(removeColumnAction({ id: 'b', tableId: 'o' }));

    expect(
      validateMapping(store.state, create([row('id', 'a'), row('code', 'b')]))
        .rows
    ).toEqual([null, 'removedChild']);
  });

  it('reports a second row picking a child an earlier row holds', () => {
    const store = setup();

    expect(
      validateMapping(store.state, create([row('id', 'a'), row('code', 'a')]))
        .rows
    ).toEqual([null, 'inUse']);
  });

  it('reports a place the stored lists cannot pair, and a parent gone from its table', () => {
    const store = setup();
    store.dispatchSync(removeColumnAction({ id: 'name', tableId: 'u' }));

    expect(
      validateMapping(
        store.state,
        edit(
          [
            { parentColumnId: 'id', pick: existing('a'), invalid: true },
            row(null, 'b'),
            row('email', 'c'),
            row('email', null),
            row('name', 'c'),
          ],
          CURRENT_KEY_ID
        )
      ).rows
    ).toEqual(['invalid', 'invalid', 'invalid', 'invalid', 'removedParent']);
  });
});

describe('validateMapping noKey', () => {
  it('passes rows covering the key exactly, in any order', () => {
    const store = setup();

    expect(
      validateMapping(store.state, create([row('code', 'b'), row('id', 'a')]))
        .set
    ).toEqual([]);
    expect(
      validateMapping(store.state, create([row('email', 'a')], 'unique:email'))
        .set
    ).toEqual([]);
  });

  it('reports a draft with no key, or a key the parent no longer declares', () => {
    const store = setup();
    store.dispatchSync(
      changeColumnUniqueAction({ id: 'email', tableId: 'u', value: false })
    );

    expect(validateMapping(store.state, create([], null)).set).toEqual([
      'noKey',
    ]);
    expect(
      validateMapping(store.state, create([row('email', 'a')], 'unique:email'))
        .set
    ).toEqual(['noKey']);
  });

  it('reports rows that cover part of a primary key a column joined since', () => {
    const store = setup();
    const draft = create([row('id', 'a'), row('code', 'b')]);
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ id: 'name', tableId: 'u', value: true })
    );

    expect(validateMapping(store.state, draft).set).toEqual(['noKey']);
  });

  it('reports rows covering more than a primary key a column left since', () => {
    const store = setup();
    const draft = create([row('id', 'a'), row('code', 'b')]);
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ id: 'code', tableId: 'u', value: false })
    );

    expect(validateMapping(store.state, draft).set).toEqual(['noKey']);
  });

  it('reports rows naming one parent twice, or a place with no parent', () => {
    const store = setup();

    expect(
      validateMapping(store.state, create([row('id', 'a'), row('id', 'b')])).set
    ).toEqual(['noKey']);
    expect(
      validateMapping(store.state, create([row('id', 'a'), row(null, 'b')])).set
    ).toEqual(['noKey']);
  });

  it('never reports the stored columns kept as they are', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name']], ['o', ['a']]);

    expect(
      validateMapping(store.state, edit([row('name', 'b')], CURRENT_KEY_ID)).set
    ).toEqual([]);
  });
});

describe('validateMapping selfOnly', () => {
  function selfSetup() {
    const store = createMapStore();
    seedMapTable(store, 'e', 'employee', [
      { id: 'tenant', primaryKey: true },
      { id: 'id', primaryKey: true },
      { id: 'manager' },
    ]);
    return store;
  }

  it('reports a mapping whose every row references its own column', () => {
    const store = selfSetup();

    expect(
      validateMapping(
        store.state,
        create(
          [row('tenant', 'tenant'), row('id', 'id')],
          'primaryKey:e',
          'e',
          'e'
        )
      ).set
    ).toEqual(['selfOnly']);
  });

  it('allows one row on its own column beside one that is not', () => {
    const store = selfSetup();

    expect(
      validateMapping(
        store.state,
        create(
          [row('tenant', 'tenant'), row('id', 'manager')],
          'primaryKey:e',
          'e',
          'e'
        )
      ).set
    ).toEqual([]);
  });
});

describe('validateMapping duplicate', () => {
  it('reports another relationship over the same columns, however it pairs them', () => {
    const store = setup();
    seedMapRelationship(store, 'r1', ['u', ['id', 'code']], ['o', ['a', 'b']]);

    expect(
      validateMapping(store.state, create([row('id', 'b'), row('code', 'a')]))
        .set
    ).toEqual(['duplicate']);
  });

  it('leaves out the relationship the draft edits', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);

    expect(
      validateMapping(store.state, edit([row('id', 'b'), row('code', 'a')])).set
    ).toEqual([]);
  });

  it('allows the opposite direction, another child column set, and a removed relationship', () => {
    const store = setup();
    seedMapRelationship(store, 'back', ['o', ['a']], ['u', ['email']]);
    seedMapRelationship(store, 'role', ['u', ['email']], ['o', ['b']]);
    seedMapRelationship(store, 'gone', ['u', ['email']], ['o', ['a']]);
    store.dispatchSync(removeRelationshipAction({ id: 'gone' }));

    expect(
      validateMapping(store.state, create([row('email', 'a')], 'unique:email'))
        .set
    ).toEqual([]);
  });

  it('judges no incomplete mapping a duplicate', () => {
    const store = setup();
    seedMapRelationship(store, 'r1', ['u', ['id', 'code']], ['o', ['a', 'b']]);

    expect(
      validateMapping(
        store.state,
        create([row('id', 'a'), row('code', { kind: 'new' })])
      ).set
    ).toEqual([]);
  });
});

describe('validateMapping unchanged', () => {
  it('reports an edit pairing the columns the relationship pairs, in any order', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);

    expect(
      validateMapping(store.state, edit([row('code', 'b'), row('id', 'a')])).set
    ).toEqual(['unchanged']);
  });

  it('takes a new column, another pairing or a broken stored mapping for a change', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);
    seedMapRelationship(store, 'broken', ['u', ['email']], ['o', ['c', 'a']]);

    expect(
      validateMapping(
        store.state,
        edit([row('id', 'a'), row('code', { kind: 'new' })])
      ).set
    ).toEqual([]);
    expect(
      validateMapping(store.state, edit([row('id', 'b'), row('code', 'a')])).set
    ).toEqual([]);
    expect(
      validateMapping(
        store.state,
        edit([row('email', 'c')], 'unique:email', 'broken')
      ).set
    ).toEqual([]);
  });

  it('reads nothing of a draft for a relationship it cannot find', () => {
    const store = setup();
    const draft = edit([row('id', 'a')], 'primaryKey:u', 'ghost');

    expect(getDraftEnds(store.state, draft)).toBeNull();
    expect(validateMapping(store.state, draft)).toEqual({
      rows: ['removedParent'],
      set: ['noKey'],
    });
  });
});

describe('hasMappingIssues', () => {
  it('counts any row issue and the set issues not ignored', () => {
    expect(hasMappingIssues({ rows: [null], set: [] })).toBe(false);
    expect(hasMappingIssues({ rows: [null, 'unpicked'], set: [] })).toBe(true);
    expect(hasMappingIssues({ rows: [], set: ['unchanged'] })).toBe(true);
    expect(
      hasMappingIssues({ rows: [], set: ['unchanged'] }, ['unchanged'])
    ).toBe(false);
  });
});

describe('hasMappingTargets', () => {
  it('needs both tables of a new relationship in the document', () => {
    const store = setup();
    const draft = create([row('id', 'a'), row('code', 'b')]);

    expect(hasMappingTargets(store.state, draft)).toBe(true);
    store.dispatchSync(removeTableAction({ id: 'o' }));
    expect(hasMappingTargets(store.state, draft)).toBe(false);
  });

  it('needs the edited relationship and both its tables in the document', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['email']], ['o', ['a']]);
    seedMapRelationship(store, 'r2', ['u', ['email']], ['o', ['b']]);
    const draft = edit([row('email', 'c')], 'unique:email');

    expect(hasMappingTargets(store.state, draft)).toBe(true);
    store.dispatchSync(removeRelationshipAction({ id: 'r' }));
    expect(hasMappingTargets(store.state, draft)).toBe(false);

    const other = edit([row('email', 'c')], 'unique:email', 'r2');
    store.dispatchSync(removeTableAction({ id: 'u' }));
    expect(hasMappingTargets(store.state, other)).toBe(false);
  });
});

describe('isSameResult', () => {
  it('finds a relationship of any kind between the same tables pairing the same columns', () => {
    const store = setup();
    seedMapRelationship(
      store,
      'r1',
      ['u', ['code', 'id']],
      ['o', ['b', 'a']],
      RelationshipType.ZeroOne
    );

    expect(
      isSameResult(store.state, create([row('id', 'a'), row('code', 'b')]))
    ).toBe(true);
    expect(
      isSameResult(store.state, create([row('id', 'b'), row('code', 'a')]))
    ).toBe(false);
  });

  it('finds the edited relationship already pairing the columns', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);

    expect(
      isSameResult(store.state, edit([row('code', 'b'), row('id', 'a')]))
    ).toBe(true);
    expect(
      isSameResult(store.state, edit([row('code', 'c'), row('id', 'a')]))
    ).toBe(false);
  });

  it('never matches a draft with a new, empty, removed or repeated row', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'code']], ['o', ['a', 'b']]);

    for (const rows of [
      [row('id', 'a'), row('code', { kind: 'new' })],
      [row('id', 'a'), row('code', null)],
      [
        row('id', 'a'),
        { parentColumnId: 'code', pick: existing('b'), invalid: true },
      ],
      [row('id', 'a'), row('id', 'a'), row('code', 'b')],
    ]) {
      expect(isSameResult(store.state, edit(rows))).toBe(false);
    }

    store.dispatchSync(removeColumnAction({ id: 'b', tableId: 'o' }));
    expect(
      isSameResult(store.state, edit([row('id', 'a'), row('code', 'b')]))
    ).toBe(false);
  });

  it('never matches a stored mapping that repeats a column', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['id', 'id']], ['o', ['a', 'a']]);

    expect(isSameResult(store.state, edit([row('id', 'a')]))).toBe(false);
    expect(isSameResult(store.state, create([row('id', 'a')]))).toBe(false);
    expect(
      isSameResult(store.state, edit([row('id', 'a')], 'primaryKey:u', 'ghost'))
    ).toBe(false);
  });

  it('reads a parent column gone from its table as no result', () => {
    const store = setup();
    seedMapRelationship(store, 'r', ['u', ['name']], ['o', ['a']]);
    store.dispatchSync(removeColumnAction({ id: 'name', tableId: 'u' }));
    addMapColumn(store, 'o', { id: 'd' });

    expect(
      isSameResult(store.state, edit([row('name', 'a')], CURRENT_KEY_ID))
    ).toBe(false);
  });
});
