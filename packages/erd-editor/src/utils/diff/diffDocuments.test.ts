import { describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { type DiffSeed, diffStateOf } from '@/__test-utils__/diffSeed';
import {
  COLUMN_KEY_PATH,
  Diff,
  ENTITY_PATH,
  MEMO_VALUE_PATH,
  TABLE_GROUP_NAME_PATH,
} from '@/components/erd/diff-viewer/diff';
import { ReferentialAction, RelationshipType } from '@/constants/schema';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';

import { diffDocuments } from './diffDocuments';
import {
  type DiffEntry,
  DiffField,
  DiffKind,
  DiffStatus,
  type DocumentDiff,
} from './types';

const diff = (prev: DiffSeed, next: DiffSeed) =>
  diffDocuments(diffStateOf(prev), diffStateOf(next));

const LETTER: Record<DiffStatus, string> = {
  [DiffStatus.added]: 'A',
  [DiffStatus.modified]: 'M',
  [DiffStatus.deleted]: 'D',
  [DiffStatus.renamed]: 'R',
};

/** Each entry as its kind, status letter and name, its children after it, indented. */
function outline(items: DiffEntry[], depth = 0): string[] {
  return items.flatMap(item => [
    `${'  '.repeat(depth)}${item.kind} ${item.status ? LETTER[item.status] : '~'} ${item.name}`,
    ...outline(item.children, depth + 1),
  ]);
}

const all = (result: DocumentDiff) => [
  ...outline(result.entries.tables),
  ...outline(result.entries.tableGroups),
  ...outline(result.entries.memos),
];

const flags = (map: Map<string, Map<string, number>>, id: string) =>
  Object.fromEntries(map.get(id) ?? []);

const USERS = {
  id: 'users',
  name: 'users',
  columns: [
    { id: 'u.id', name: 'id', dataType: 'BIGINT', pk: true },
    { id: 'u.email', name: 'email', dataType: 'VARCHAR' },
  ],
};

const ORDERS = {
  id: 'orders',
  name: 'orders',
  x: 400,
  columns: [
    { id: 'o.id', name: 'id', pk: true },
    { id: 'o.user', name: 'user_id' },
  ],
};

describe('diffDocuments', () => {
  it('finds nothing between a document and itself', () => {
    const seed: DiffSeed = {
      tables: [USERS, ORDERS],
      memos: [{ id: 'm', value: 'note' }],
      groups: [{ id: 'g', name: 'Billing' }],
    };

    const result = diff(seed, seed);

    expect(all(result)).toEqual([]);
    expect(result.prev.size).toBe(0);
    expect(result.next.size).toBe(0);
  });

  it('tells a rename in an earlier version of the file as one R, never a removal and an addition (AC-D2)', () => {
    const result = diff(
      {
        tables: [USERS],
        indexes: [
          {
            id: 'ix',
            tableId: 'users',
            name: 'ix_email',
            columns: ['u.email'],
          },
        ],
        groups: [{ id: 'g', name: 'Billing' }],
      },
      {
        tables: [
          {
            ...USERS,
            name: 'members',
            columns: [USERS.columns[0], { ...USERS.columns[1], name: 'mail' }],
          },
        ],
        indexes: [
          { id: 'ix', tableId: 'users', name: 'ix_mail', columns: ['u.email'] },
        ],
        groups: [{ id: 'g', name: 'Payments' }],
      }
    );

    expect(all(result)).toEqual([
      'table R members',
      '  column R mail',
      '  index R ix_mail',
      'tableGroup R Payments',
    ]);
    expect(result.entries.tables[0]).toMatchObject({
      prevName: 'users',
      changes: [{ field: DiffField.name, before: 'users', after: 'members' }],
    });
  });

  it('pairs a file from elsewhere by name, one to one, the rest added or removed (AC-D3)', () => {
    const result = diff(
      {
        tables: [
          { id: 'a1', name: 'users', columns: [{ id: 'a1.c', name: 'id' }] },
          { id: 'a2', name: 'legacy' },
        ],
      },
      {
        tables: [
          {
            id: 'b1',
            name: 'users',
            columns: [
              { id: 'b1.c', name: 'id' },
              { id: 'b1.d', name: 'email' },
            ],
          },
          { id: 'b2', name: 'orders' },
        ],
      }
    );

    expect(all(result)).toEqual([
      'table D legacy',
      'table A orders',
      'table ~ users',
      '  column A email',
    ]);
    expect(result.entries.tables[2]).toMatchObject({
      prevId: 'a1',
      nextId: 'b1',
    });
  });

  it('carries the logical names on each table and column entry, a change to one alone listing nothing', () => {
    const named = (table: string, column: string) => ({
      tables: [
        {
          ...USERS,
          logicalName: table,
          columns: [
            USERS.columns[0],
            { ...USERS.columns[1], logicalName: column },
          ],
        },
      ],
    });

    expect(
      all(diff(named('Users', 'Email'), named('Members', 'Mail')))
    ).toEqual([]);

    const renamed = diff(named('Users', 'Email'), {
      tables: [
        {
          ...named('Members', 'Mail').tables[0],
          name: 'members',
          columns: [
            USERS.columns[0],
            { ...USERS.columns[1], name: 'mail', logicalName: 'Mail' },
          ],
        },
      ],
    });
    const [table] = renamed.entries.tables;

    expect(table).toMatchObject({
      name: 'members',
      prevName: 'users',
      logicalName: 'Members',
      prevLogicalName: 'Users',
    });
    expect(table.children[0]).toMatchObject({
      logicalName: 'Mail',
      prevLogicalName: 'Email',
    });
  });

  it('gives an entry of any other kind no logical name', () => {
    const result = diff(
      {
        memos: [{ id: 'm', value: 'draft' }],
        groups: [{ id: 'g', name: 'A' }],
      },
      { memos: [{ id: 'm', value: 'final' }], groups: [{ id: 'g', name: 'B' }] }
    );

    expect(
      [...result.entries.memos, ...result.entries.tableGroups].map(entry => [
        entry.logicalName,
        entry.prevLogicalName,
      ])
    ).toEqual([
      ['', ''],
      ['', ''],
    ]);
  });

  it('never pairs two unnamed entities by their name', () => {
    const result = diff(
      { tables: [{ id: 'a', name: '' }] },
      { tables: [{ id: 'b', name: '' }] }
    );

    expect(all(result)).toEqual(['table D ', 'table A ']);
  });

  it('marks a change to an index, a foreign key, a memo and a group as M (AC-D4)', () => {
    const tables = [USERS, ORDERS];
    const result = diff(
      {
        tables,
        indexes: [
          { id: 'ix', tableId: 'users', name: 'ix', columns: ['u.email'] },
        ],
        relationships: [
          {
            id: 'fk',
            parent: ['users', ['u.id']],
            child: ['orders', ['o.user']],
          },
        ],
        memos: [{ id: 'm', value: 'draft' }],
        groups: [{ id: 'g', name: 'Billing' }],
      },
      {
        tables: [USERS, { ...ORDERS, group: 'g' }],
        indexes: [
          {
            id: 'ix',
            tableId: 'users',
            name: 'ix',
            unique: true,
            columns: [['u.email', 'DESC']],
          },
        ],
        relationships: [
          {
            id: 'fk',
            parent: ['users', ['u.id']],
            child: ['orders', ['o.user']],
            type: RelationshipType.ZeroN,
            onDelete: ReferentialAction.cascade,
          },
        ],
        memos: [{ id: 'm', value: 'final' }],
        groups: [{ id: 'g', name: 'Billing' }],
      }
    );

    expect(all(result)).toEqual([
      'table M orders',
      '  foreignKey M user_id → users(id)',
      'table ~ users',
      '  index M ix',
      'tableGroup M Billing',
      'memo M final',
    ]);
    const [orders, users] = result.entries.tables;
    expect(orders.changes.map(({ field }) => field)).toEqual([
      DiffField.tableGroup,
    ]);
    expect(orders.children[0].changes.map(({ field }) => field)).toEqual([
      DiffField.relationshipType,
      DiffField.onDelete,
    ]);
    expect(users.children[0].changes).toEqual([
      { field: DiffField.unique, before: false, after: true },
      { field: DiffField.columns, before: 'email', after: 'email DESC' },
    ]);
    expect(result.entries.tableGroups[0].changes).toEqual([
      { field: DiffField.members, before: '', after: 'orders' },
    ]);
  });

  it('marks a table, memo or group moved, resized or recoloured as M, but not one whose z-index alone moved (AC-D5)', () => {
    const result = diff(
      {
        tables: [
          { id: 't', name: 't', x: 0, y: 0, zIndex: 1 },
          { id: 'z', name: 'z', zIndex: 2 },
        ],
        memos: [{ id: 'm', value: 'note', width: 120, height: 80 }],
        groups: [{ id: 'g', name: 'g', width: 300 }],
      },
      {
        tables: [
          { id: 't', name: 't', x: 40, y: 0, zIndex: 1, color: '#ff0000' },
          { id: 'z', name: 'z', zIndex: 9 },
        ],
        memos: [{ id: 'm', value: 'note', width: 200, height: 80 }],
        groups: [{ id: 'g', name: 'g', width: 500 }],
      }
    );

    expect(all(result)).toEqual(['table M t', 'tableGroup M g', 'memo M note']);
    expect(result.entries.tables[0].changes).toEqual([
      { field: DiffField.position, before: '0, 0', after: '40, 0' },
      { field: DiffField.color, before: '', after: '#ff0000' },
    ]);
    expect(result.entries.memos[0].changes).toEqual([
      { field: DiffField.size, before: '120 × 80', after: '200 × 80' },
    ]);
  });

  it('marks only the columns outside the longest run both orders share as moved (AC-D6)', () => {
    const columns = [
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b' },
      { id: 'c', name: 'c' },
    ];
    const result = diff(
      { tables: [{ id: 't', name: 't', columns }] },
      {
        tables: [
          { id: 't', name: 't', columns: [columns[1], columns[2], columns[0]] },
        ],
      }
    );

    expect(all(result)).toEqual(['table ~ t', '  column M a']);
    expect(result.entries.tables[0].children[0].changes).toEqual([
      { field: DiffField.order, before: 1, after: 3 },
    ]);
  });

  it('marks a column added at the front alone, moving none of the others (AC-D15)', () => {
    const columns = [
      { id: 'a', name: 'a' },
      { id: 'b', name: 'b' },
    ];
    const result = diff(
      { tables: [{ id: 't', name: 't', columns }] },
      {
        tables: [
          {
            id: 't',
            name: 't',
            columns: [{ id: 'new', name: 'new' }, ...columns],
          },
        ],
      }
    );

    expect(all(result)).toEqual(['table ~ t', '  column A new']);
  });

  it('puts a removed column back where it stood among the current ones', () => {
    const result = diff(
      {
        tables: [
          {
            id: 't',
            name: 't',
            columns: [
              { id: 'a', name: 'a' },
              { id: 'gone', name: 'gone' },
              { id: 'b', name: 'b', comment: 'x' },
            ],
          },
        ],
      },
      {
        tables: [
          {
            id: 't',
            name: 't',
            columns: [
              { id: 'a', name: 'a', comment: 'y' },
              { id: 'b', name: 'b', comment: 'y' },
            ],
          },
        ],
      }
    );

    expect(all(result)).toEqual([
      'table ~ t',
      '  column M a',
      '  column D gone',
      '  column M b',
    ]);
  });

  it('pairs index columns by the column they key, whatever ids a load gives them (AC-D13)', () => {
    const tables = [USERS];
    const indexes = [
      { id: 'ix', tableId: 'users', name: 'ix', columns: ['u.email', 'u.id'] },
    ];

    const result = diff(
      { tables, indexes, indexColumnTail: '-first' },
      { tables, indexes, indexColumnTail: '-second' }
    );

    expect(all(result)).toEqual([]);
  });

  it('finds nothing in a v2 file loaded twice, which gives its index columns new ids each time (AC-D13)', () => {
    const v2 = JSON.stringify({
      canvas: { version: '2.2.11' },
      table: {
        tables: [
          {
            id: 't',
            name: 'users',
            comment: '',
            columns: [
              {
                id: 'c',
                name: 'email',
                comment: '',
                dataType: '',
                default: '',
                option: {
                  autoIncrement: false,
                  primaryKey: false,
                  unique: false,
                  notNull: false,
                },
                ui: {
                  active: false,
                  pk: false,
                  fk: false,
                  pfk: false,
                  widthName: 60,
                  widthComment: 60,
                  widthDataType: 60,
                  widthDefault: 60,
                },
              },
            ],
            ui: {
              active: false,
              top: 0,
              left: 0,
              zIndex: 1,
              widthName: 60,
              widthComment: 60,
            },
          },
        ],
        indexes: [
          {
            id: 'ix',
            name: 'ix_email',
            tableId: 't',
            unique: false,
            columns: [{ id: 'c', orderType: 'ASC' }],
          },
        ],
      },
      memo: { memos: [] },
      relationship: { relationships: [] },
    });
    const load = () => {
      const app = createTestAppContext();
      app.store.dispatchSync(initialLoadJsonAction$(v2));
      const { state } = app.store;
      app.store.destroy();
      return state;
    };
    const [prev, next] = [load(), load()];
    expect(prev.collections.indexEntities.ix.indexColumnIds).not.toEqual(
      next.collections.indexEntities.ix.indexColumnIds
    );

    expect(all(diffDocuments(prev, next))).toEqual([]);
  });

  it('reads no removed table a runtime value keeps, while one removed since reads as deleted (AC-D14)', () => {
    const result = diff(
      { tables: [USERS, ORDERS] },
      {
        tables: [USERS, ORDERS, { id: 'temp', name: 'temp' }],
        removed: ['temp', 'orders'],
      }
    );

    expect(all(result)).toEqual(['table D orders']);
  });

  it('sorts tables by name, a removed one by the name it had and a renamed one by its new name', () => {
    const result = diff(
      {
        tables: [
          { id: 'b', name: 'beta' },
          { id: 'z', name: 'zeta' },
        ],
      },
      {
        tables: [
          { id: 'z', name: 'alpha' },
          { id: 'c', name: 'Charlie' },
        ],
      }
    );

    expect(all(result)).toEqual([
      'table R alpha',
      'table D beta',
      'table A Charlie',
    ]);
  });

  it('lists nothing inside a table added or removed, its foreign keys included', () => {
    const result = diff(
      { tables: [USERS] },
      {
        tables: [USERS, ORDERS],
        indexes: [
          { id: 'ix', tableId: 'orders', name: 'ix', columns: ['o.id'] },
        ],
        relationships: [
          {
            id: 'fk',
            parent: ['users', ['u.id']],
            child: ['orders', ['o.user']],
          },
        ],
      }
    );

    expect(all(result)).toEqual(['table A orders']);
    expect(result.next.has('fk')).toBe(false);
  });

  it('pairs memos by what they say, then by where they stand', () => {
    const result = diff(
      {
        memos: [
          { id: 'a', value: 'same', x: 0 },
          { id: 'b', value: 'old', x: 300, y: 40 },
        ],
      },
      {
        memos: [
          { id: 'c', value: 'new', x: 300, y: 40 },
          { id: 'd', value: 'same', x: 10 },
        ],
      }
    );

    expect(all(result)).toEqual(['memo M new', 'memo M same']);
    expect(result.entries.memos.map(({ prevId }) => prevId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('pairs unnamed groups by the tables they share most', () => {
    const result = diff(
      {
        tables: [
          { id: 't1', name: 't1', group: 'g1' },
          { id: 't2', name: 't2', group: 'g2' },
        ],
        groups: [
          { id: 'g1', name: '' },
          { id: 'g2', name: '' },
        ],
      },
      {
        tables: [
          { id: 't1', name: 't1', group: 'h2' },
          { id: 't2', name: 't2', group: 'h1' },
        ],
        groups: [
          { id: 'h1', name: '' },
          { id: 'h2', name: '' },
        ],
      }
    );

    expect(all(result)).toEqual([]);
  });

  it('marks in each pane exactly what each entry says, one to one (AC-D17)', () => {
    const result = diff(
      {
        tables: [
          USERS,
          { ...ORDERS, comment: 'old' },
          { id: 'gone', name: 'gone' },
        ],
        relationships: [
          {
            id: 'fk',
            parent: ['users', ['u.id']],
            child: ['orders', ['o.user']],
          },
        ],
        memos: [{ id: 'm', value: 'draft' }],
        groups: [{ id: 'g', name: 'Billing' }],
      },
      {
        tables: [
          {
            ...USERS,
            name: 'members',
            columns: [
              { ...USERS.columns[0], pk: false },
              USERS.columns[1],
              { id: 'u.new', name: 'phone' },
            ],
          },
          { ...ORDERS, comment: 'new', x: 900 },
          { id: 'added', name: 'added' },
        ],
        relationships: [
          {
            id: 'fk',
            parent: ['users', ['u.id']],
            child: ['orders', ['o.user']],
            onUpdate: ReferentialAction.cascade,
          },
        ],
        memos: [{ id: 'm', value: 'final' }],
        groups: [
          { id: 'g', name: 'Payments' },
          { id: 'h', name: 'New group' },
        ],
      }
    );

    expect(flags(result.next, 'users')).toEqual({
      [FocusType.tableName]: Diff.rename,
    });
    expect(flags(result.prev, 'users')).toEqual({
      [FocusType.tableName]: Diff.rename,
    });
    expect(flags(result.next, 'u.id')).toEqual({
      [COLUMN_KEY_PATH]: Diff.modify,
    });
    expect(flags(result.next, 'u.new')).toEqual({ [ENTITY_PATH]: Diff.insert });
    expect(result.prev.has('u.new')).toBe(false);
    expect(flags(result.next, 'orders')).toEqual({
      [FocusType.tableComment]: Diff.modify,
      [ENTITY_PATH]: Diff.modify,
    });
    expect(flags(result.prev, 'gone')).toEqual({
      [ENTITY_PATH]: Diff.delete,
      [FocusType.tableName]: Diff.delete,
    });
    expect(result.next.has('gone')).toBe(false);
    expect(flags(result.next, 'added')).toEqual({
      [ENTITY_PATH]: Diff.insert,
      [FocusType.tableName]: Diff.insert,
    });
    expect(flags(result.next, 'fk')).toEqual({ [ENTITY_PATH]: Diff.modify });
    expect(flags(result.next, 'm')).toEqual({ [MEMO_VALUE_PATH]: Diff.modify });
    expect(flags(result.next, 'g')).toEqual({
      [TABLE_GROUP_NAME_PATH]: Diff.rename,
    });
    expect(flags(result.next, 'h')).toEqual({
      [ENTITY_PATH]: Diff.insert,
      [TABLE_GROUP_NAME_PATH]: Diff.insert,
    });

    // Every id a pane marks is one an entry names on that side.
    const named = { prev: new Set<string>(), next: new Set<string>() };
    const walk = (items: DiffEntry[]) =>
      items.forEach(item => {
        if (item.status && item.kind !== DiffKind.index) {
          item.prevId &&
            item.status !== DiffStatus.added &&
            named.prev.add(item.prevId);
          item.nextId &&
            item.status !== DiffStatus.deleted &&
            named.next.add(item.nextId);
        }
        walk(item.children);
      });
    walk([
      ...result.entries.tables,
      ...result.entries.tableGroups,
      ...result.entries.memos,
    ]);
    expect(new Set(result.prev.keys())).toEqual(named.prev);
    expect(new Set(result.next.keys())).toEqual(named.next);
  });
});
