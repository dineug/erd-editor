import { describe, expect, it } from 'vite-plus/test';

import { type DiffSeed, diffStateOf } from '@/__test-utils__/diffSeed';

import {
  compareColumns,
  compareForeignKeys,
  compareIndexes,
  compareMemos,
  compareTableGroups,
  compareTables,
  type DiffContext,
  foreignKeyText,
} from './compareEntities';
import { pairEntities } from './pairEntities';
import { DiffField } from './types';

/** Both documents with every entity paired by id, as the same file's two versions pair. */
function contextOf(prev: DiffSeed, next: DiffSeed): DiffContext {
  const prevState = diffStateOf(prev);
  const nextState = diffStateOf(next);
  const all = <
    K extends 'tableEntities' | 'tableColumnEntities' | 'tableGroupEntities',
  >(
    key: K
  ) =>
    [
      Object.values(prevState.collections[key]),
      Object.values(nextState.collections[key]),
    ] as const;

  return {
    prev: prevState,
    next: nextState,
    tables: pairEntities(...all('tableEntities')),
    columns: pairEntities(...all('tableColumnEntities')),
    tableGroups: pairEntities(...all('tableGroupEntities')),
  };
}

const TABLE = {
  id: 't',
  name: 'users',
  columns: [
    { id: 'a', name: 'id' },
    { id: 'b', name: 'email' },
  ],
};

describe('compareTables', () => {
  it('reads neither the z-index nor the widths its text gives it', () => {
    const ctx = contextOf({ tables: [TABLE] }, { tables: [TABLE] });
    const prev = ctx.prev.collections.tableEntities.t;
    const next = {
      ...prev,
      ui: { ...prev.ui, zIndex: 99, widthName: 300, widthComment: 400 },
    };

    expect(compareTables(ctx, prev, next)).toEqual([]);
  });

  it('reads a group the document no longer lists as none, and shows a group by its name', () => {
    const ctx = contextOf(
      {
        tables: [{ ...TABLE, group: 'g' }],
        groups: [{ id: 'g', name: 'Billing' }],
      },
      {
        tables: [{ ...TABLE, group: 'h' }],
        groups: [{ id: 'h', name: 'Sales' }],
      }
    );
    const prev = ctx.prev.collections.tableEntities.t;
    const next = ctx.next.collections.tableEntities.t;

    expect(compareTables(ctx, prev, next)).toEqual([
      { field: DiffField.tableGroup, before: 'Billing', after: 'Sales' },
    ]);
    expect(
      compareTables(
        ctx,
        { ...prev, groupId: 'missing' },
        { ...next, groupId: '' }
      )
    ).toEqual([]);
  });

  it('rounds where a table stands, so a fraction moved is no move', () => {
    const ctx = contextOf({ tables: [TABLE] }, { tables: [TABLE] });
    const prev = ctx.prev.collections.tableEntities.t;

    expect(
      compareTables(ctx, prev, { ...prev, ui: { ...prev.ui, x: 0.2 } })
    ).toEqual([]);
  });
});

describe('compareColumns', () => {
  it('reads each option as on or off, and a move by where the column stood and stands', () => {
    const ctx = contextOf(
      { tables: [{ ...TABLE, columns: [{ id: 'a', name: 'id' }] }] },
      {
        tables: [
          {
            ...TABLE,
            columns: [
              { id: 'a', name: 'id', pk: true, nn: true, uq: true, ai: true },
            ],
          },
        ],
      }
    );
    const prev = ctx.prev.collections.tableColumnEntities.a;
    const next = ctx.next.collections.tableColumnEntities.a;

    expect(
      compareColumns(prev, next, { before: 1, after: 2 }).map(
        ({ field }) => field
      )
    ).toEqual([
      DiffField.autoIncrement,
      DiffField.primaryKey,
      DiffField.unique,
      DiffField.notNull,
      DiffField.order,
    ]);
  });
});

describe('compareIndexes', () => {
  it('reads a key column the current document lacks as a change of columns', () => {
    const ctx = contextOf(
      {
        tables: [TABLE],
        indexes: [{ id: 'ix', tableId: 't', name: 'ix', columns: ['b'] }],
      },
      {
        tables: [
          { ...TABLE, columns: [TABLE.columns[0], { id: 'c', name: 'mail' }] },
        ],
        indexes: [{ id: 'ix', tableId: 't', name: 'ix', columns: ['c'] }],
      }
    );

    expect(
      compareIndexes(
        ctx,
        ctx.prev.collections.indexEntities.ix,
        ctx.next.collections.indexEntities.ix
      )
    ).toEqual([{ field: DiffField.columns, before: 'email', after: 'mail' }]);
  });
});

describe('compareForeignKeys', () => {
  const seed = (childColumn: string): DiffSeed => ({
    tables: [
      TABLE,
      {
        id: 'o',
        name: 'orders',
        columns: [
          { id: 'o.a', name: 'user_id' },
          { id: 'o.b', name: 'owner_id' },
        ],
      },
    ],
    relationships: [
      { id: 'fk', parent: ['t', ['a']], child: ['o', [childColumn]] },
    ],
  });

  it('writes a foreign key as its columns, the parent and the parent columns', () => {
    const ctx = contextOf(seed('o.a'), seed('o.a'));

    expect(
      foreignKeyText(ctx.prev, ctx.prev.collections.relationshipEntities.fk)
    ).toBe('user_id → users(id)');
  });

  it('reads another child column as a change of its column pairs', () => {
    const ctx = contextOf(seed('o.a'), seed('o.b'));

    expect(
      compareForeignKeys(
        ctx,
        ctx.prev.collections.relationshipEntities.fk,
        ctx.next.collections.relationshipEntities.fk
      )
    ).toEqual([
      {
        field: DiffField.columns,
        before: 'user_id → users(id)',
        after: 'owner_id → users(id)',
      },
    ]);
  });
});

describe('compareMemos and compareTableGroups', () => {
  it('reads a memo recoloured, and a group recoloured, moved and grown', () => {
    const ctx = contextOf(
      {
        memos: [{ id: 'm', value: 'note' }],
        groups: [{ id: 'g', name: 'g', x: 0, width: 300 }],
      },
      {
        memos: [{ id: 'm', value: 'note', color: '#00ff00' }],
        groups: [{ id: 'g', name: 'g', color: '#ff0000', x: 20, width: 320 }],
      }
    );

    expect(
      compareMemos(
        ctx.prev.collections.memoEntities.m,
        ctx.next.collections.memoEntities.m
      )
    ).toEqual([{ field: DiffField.color, before: '', after: '#00ff00' }]);
    expect(
      compareTableGroups(
        ctx,
        ctx.prev.collections.tableGroupEntities.g,
        ctx.next.collections.tableGroupEntities.g
      ).map(({ field }) => field)
    ).toEqual([DiffField.color, DiffField.position, DiffField.size]);
  });
});
