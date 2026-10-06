import { describe, expect, it } from 'vite-plus/test';

import {
  createMapStore,
  MapSeedColumn,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { BracketType } from '@/constants/schema';
import { changeBracketTypeAction } from '@/engine/modules/settings/atom.actions';
import { ColumnPick } from '@/utils/map-columns/mapping';
import { prefillPicks, toPrefillNames } from '@/utils/map-columns/prefill';

const existing = (columnId: string): ColumnPick => ({
  kind: 'existing',
  columnId,
});

function setup(
  parent: [string, MapSeedColumn[]],
  child: [string, MapSeedColumn[]] | null
) {
  const store = createMapStore();
  seedMapTable(store, 'p', ...parent);
  if (child) seedMapTable(store, 'c', ...child);

  const { tableEntities } = store.state.collections;
  return {
    store,
    fill: (
      rows: Array<[string, ColumnPick | null]>,
      keyKind: 'primaryKey' | 'unique' = 'primaryKey'
    ) =>
      prefillPicks(store.state, {
        parentTable: tableEntities.p,
        childTable: child ? tableEntities.c : tableEntities.p,
        keyKind,
        rows: rows.map(([parentColumnId, pick]) => ({ parentColumnId, pick })),
      }),
  };
}

describe('toPrefillNames', () => {
  it('takes the name a new foreign key column gets, without case', () => {
    expect(toPrefillNames('Users', 'ID', BracketType.none, false)).toEqual(
      new Set(['users_id'])
    );
    expect(
      toPrefillNames('users', 'member_id', BracketType.none, false)
    ).toEqual(new Set(['member_id']));
  });

  it('adds the name taken from the table name without its schema', () => {
    expect(
      toPrefillNames('public.users', 'id', BracketType.none, false)
    ).toEqual(new Set(['public.users_id', 'users_id']));
    expect(
      toPrefillNames('public.users', 'id', BracketType.doubleQuote, false)
    ).toEqual(new Set(['public.users_id']));
  });

  it('adds the column name itself for a unique key', () => {
    expect(toPrefillNames('vehicle', 'VIN', BracketType.none, true)).toEqual(
      new Set(['vehicle_vin', 'vin'])
    );
  });

  it('takes no blank name', () => {
    expect(toPrefillNames('users', '  ', BracketType.none, true)).toEqual(
      new Set()
    );
  });
});

describe('prefillPicks', () => {
  it('picks the one child column a candidate name matches, never the key name alone', () => {
    const { fill } = setup(
      ['users', [{ id: 'pid', name: 'id', primaryKey: true }]],
      [
        'orders',
        [
          { id: 'cid', name: 'id' },
          { id: 'fk', name: 'users_id' },
        ],
      ]
    );

    expect(fill([['pid', null]])).toEqual({ pid: existing('fk') });
  });

  it('matches a key name of several words as it is', () => {
    const { fill } = setup(
      ['members', [{ id: 'pid', name: 'member_id', primaryKey: true }]],
      ['orders', [{ id: 'fk', name: 'member_id' }]]
    );

    expect(fill([['pid', null]])).toEqual({ pid: existing('fk') });
  });

  it('matches the name built from a table name without its schema', () => {
    const { fill } = setup(
      ['public.users', [{ id: 'pid', name: 'id', primaryKey: true }]],
      ['orders', [{ id: 'fk', name: 'users_id' }]]
    );

    expect(fill([['pid', null]])).toEqual({ pid: existing('fk') });
  });

  it('keeps the schema in the table name under a quoting bracket type', () => {
    const { store, fill } = setup(
      ['public.users', [{ id: 'pid', name: 'id', primaryKey: true }]],
      ['orders', [{ id: 'fk', name: 'users_id' }]]
    );
    store.dispatchSync(
      changeBracketTypeAction({ value: BracketType.doubleQuote })
    );

    expect(fill([['pid', null]])).toEqual({});
  });

  it('matches the same column name for a unique key alone', () => {
    const parent: [string, MapSeedColumn[]] = [
      'vehicle',
      [{ id: 'vin', name: 'VIN', unique: true }],
    ];
    const child: [string, MapSeedColumn[]] = [
      'sales',
      [{ id: 'fk', name: 'vin' }],
    ];

    expect(setup(parent, child).fill([['vin', null]], 'unique')).toEqual({
      vin: existing('fk'),
    });
    expect(setup(parent, child).fill([['vin', null]], 'primaryKey')).toEqual(
      {}
    );
  });

  it('compares names trimmed and without case', () => {
    const { fill } = setup(
      ['Users', [{ id: 'pid', name: 'Id', primaryKey: true }]],
      ['orders', [{ id: 'fk', name: '  USERS_ID ' }]]
    );

    expect(fill([['pid', null]])).toEqual({ pid: existing('fk') });
  });

  it('leaves a row empty when two columns match, or none', () => {
    const { fill } = setup(
      [
        'public.users',
        [
          { id: 'pid', name: 'id', primaryKey: true },
          { id: 'code', name: 'code', primaryKey: true },
        ],
      ],
      [
        'orders',
        [
          { id: 'a', name: 'public.users_id' },
          { id: 'b', name: 'users_id' },
          { id: 'z', name: 'other' },
        ],
      ]
    );

    expect(
      fill([
        ['pid', null],
        ['code', null],
      ])
    ).toEqual({});
  });

  it('never suggests the parent column for itself on a table referencing itself', () => {
    const { fill } = setup(
      [
        'users',
        [
          { id: 'code', name: 'code', unique: true },
          { id: 'ref', name: 'users_code' },
        ],
      ],
      null
    );

    expect(fill([['code', null]], 'unique')).toEqual({ code: existing('ref') });
  });

  it('keeps every picked row and leaves the columns rows hold to them', () => {
    const { fill } = setup(
      [
        'users',
        [
          { id: 'pid', name: 'id', primaryKey: true },
          { id: 'code', name: 'code', primaryKey: true },
        ],
      ],
      [
        'orders',
        [
          { id: 'fk', name: 'users_id' },
          { id: 'fk2', name: 'users_code' },
        ],
      ]
    );

    expect(
      fill([
        ['pid', existing('fk2')],
        ['code', null],
      ])
    ).toEqual({});
    expect(
      fill([
        ['pid', { kind: 'new' }],
        ['code', null],
      ])
    ).toEqual({ code: existing('fk2') });
  });

  it('fills the rows in order, a later row losing a column an earlier one took', () => {
    const { fill } = setup(
      [
        'users',
        [
          { id: 'a', name: 'id', primaryKey: true },
          { id: 'b', name: 'ID', primaryKey: true },
        ],
      ],
      ['orders', [{ id: 'fk', name: 'users_id' }]]
    );

    expect(
      fill([
        ['a', null],
        ['b', null],
      ])
    ).toEqual({ a: existing('fk') });
  });

  it('matches no unnamed column and skips a parent column it cannot find', () => {
    const { fill } = setup(
      ['users', [{ id: 'blank', name: '', primaryKey: true }]],
      ['orders', [{ id: 'unnamed', name: '' }]]
    );

    expect(
      fill([
        ['blank', null],
        ['ghost', null],
      ])
    ).toEqual({});
  });
});
