import { describe, expect, it } from 'vite-plus/test';

import { createTestI18n, pseudoMessages } from '@/__test-utils__';
import { type DiffSeed, diffStateOf } from '@/__test-utils__/diffSeed';
import { flattenTree } from '@/components/primitives/tree/treeModel';
import { ReferentialAction, RelationshipType } from '@/constants/schema';
import { diffDocuments, type DiffEntries, DiffKind } from '@/utils/diff';

import {
  buildDiffTree,
  describeEntry,
  diffTargets,
  type DiffTreeItem,
  entryNodeId,
  matchesFilter,
  QUOTE_LIMIT,
  statusLabel,
  statusLetter,
} from './diffTreeModel';

const i18n = createTestI18n('en');

const entriesOf = (prev: DiffSeed, next: DiffSeed): DiffEntries =>
  diffDocuments(diffStateOf(prev), diffStateOf(next)).entries;

const USERS = {
  id: 'users',
  name: 'users',
  columns: [
    { id: 'u.id', name: 'id', pk: true },
    { id: 'u.email', name: 'email' },
  ],
};
const ORDERS = {
  id: 'orders',
  name: 'orders',
  columns: [{ id: 'o.user', name: 'user_id' }],
};

const PREV: DiffSeed = {
  tables: [USERS, ORDERS, { id: 'old', name: 'old' }],
  indexes: [{ id: 'ix', tableId: 'users', name: 'ix', columns: ['u.email'] }],
  relationships: [
    { id: 'fk', parent: ['users', ['u.id']], child: ['orders', ['o.user']] },
  ],
  memos: [{ id: 'm', value: 'draft' }],
  groups: [{ id: 'g', name: 'Billing' }],
};

const NEXT: DiffSeed = {
  tables: [
    {
      ...USERS,
      name: 'members',
      columns: [USERS.columns[0], { ...USERS.columns[1], comment: 'login' }],
    },
    ORDERS,
    { id: 'added', name: 'added' },
  ],
  indexes: [
    {
      id: 'ix',
      tableId: 'users',
      name: 'ix',
      unique: true,
      columns: ['u.email'],
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
  groups: [{ id: 'g', name: 'Payments' }],
};

/** Every row, all open, as its id. */
function ids(entries: DiffEntries, filter = '') {
  const tree = buildDiffTree(entries, filter);
  const open = Object.fromEntries(
    tree.branchIds.map(id => [id, true as const])
  );
  return flattenTree(tree.roots, open).map(row => row.node.id);
}

describe('buildDiffTree', () => {
  it('lays the changes out in the Explorer folders, every row with children open (AC-D1)', () => {
    const entries = entriesOf(PREV, NEXT);
    const tree = buildDiffTree(entries);

    expect(ids(entries)).toEqual([
      'f:tables',
      't:added',
      't:users',
      't:users/f:columns',
      'c:u.email',
      't:users/f:indexes',
      'i:ix',
      't:prev-old',
      't:orders',
      't:orders/f:foreignKeys',
      'r:fk',
      'f:tableGroups',
      'g:g',
      'f:memos',
      'm:m',
    ]);
    expect(tree.branchIds).toEqual([
      'f:tables',
      't:users',
      't:users/f:columns',
      't:users/f:indexes',
      't:orders',
      't:orders/f:foreignKeys',
      'f:tableGroups',
      'f:memos',
    ]);
  });

  it('keeps what the name filter finds, by the current or the saved name, and the tables it is in (AC-D10)', () => {
    const entries = entriesOf(PREV, NEXT);

    // The foreign key reads user_id → users(id), so the filter finds it too.
    expect(ids(entries, 'USERS')).toEqual([
      'f:tables',
      't:users',
      't:users/f:columns',
      'c:u.email',
      't:users/f:indexes',
      'i:ix',
      't:orders',
      't:orders/f:foreignKeys',
      'r:fk',
    ]);
    expect(ids(entries, 'mail')).toEqual([
      'f:tables',
      't:users',
      't:users/f:columns',
      'c:u.email',
    ]);
    expect(ids(entries, 'pay')).toEqual(['f:tableGroups', 'g:g']);
    expect(ids(entries, 'nothing like it')).toEqual([]);
  });

  it('keeps what the filter finds by the current or the saved logical name too, whatever the view', () => {
    const entries = entriesOf(
      {
        tables: [
          { ...USERS, logicalName: 'Customer' },
          { id: 'old', name: 'old', logicalName: 'Archive' },
        ],
      },
      {
        tables: [
          {
            ...USERS,
            name: 'members',
            logicalName: 'Member',
            columns: [
              USERS.columns[0],
              { ...USERS.columns[1], logicalName: 'Login', comment: 'x' },
            ],
          },
        ],
      }
    );

    const users = ['f:tables', 't:users', 't:users/f:columns', 'c:u.email'];

    expect(ids(entries, 'custom')).toEqual(users);
    expect(ids(entries, 'MEMBER')).toEqual(users);
    expect(ids(entries, 'login')).toEqual([
      'f:tables',
      't:users',
      't:users/f:columns',
      'c:u.email',
    ]);
    expect(ids(entries, 'archive')).toEqual(['f:tables', 't:prev-old']);
  });

  it('builds nothing for no changes', () => {
    expect(buildDiffTree({ tables: [], tableGroups: [], memos: [] })).toEqual({
      roots: [],
      branchIds: [],
    });
  });
});

describe('the rows of the diff tree', () => {
  const entries = entriesOf(PREV, NEXT);
  const [added, users, old, orders] = entries.tables;
  const item = (entry = users, table = null as typeof users | null) =>
    ({ kind: 'entry', entry, table }) as DiffTreeItem;

  it('ends each row on its status letter, a tilde for one listed for what it holds (AC-D7)', () => {
    expect(statusLetter(item(added))).toBe('A');
    expect(statusLetter(item(users))).toBe('R');
    expect(statusLetter(item(old))).toBe('D');
    expect(statusLetter(item(users.children[0], users))).toBe('M');
    expect(statusLetter(item(orders))).toBe('~');
    expect(statusLetter({ kind: 'folder', folder: 'tables', count: 1 })).toBe(
      '~'
    );
    expect(statusLabel(null, i18n)).toBe('Changed inside');
  });

  it('says in its tooltip each change as before → after, keys and clauses as written (AC-D8)', () => {
    expect(describeEntry(users, i18n)).toBe('Renamed\nName: users → members');
    expect(describeEntry(users.children[1], i18n)).toBe(
      'Modified\nUNIQUE: ✗ → ✓'
    );
    expect(describeEntry(orders.children[0], i18n)).toBe(
      'Modified\nRelationship type: One N → Zero N\nON DELETE: — → CASCADE'
    );
    expect(describeEntry(users.children[0], i18n)).toBe(
      'Modified\nComment: — → login'
    );
  });

  it('writes the tooltip in the language given, and cuts a long quote', () => {
    const german = createTestI18n('de-DE', pseudoMessages('de'));
    expect(describeEntry(users, german)).toBe(
      'de:Renamed\nde:{field}: {before} → {after}'
        .replace('{field}', 'de:Name')
        .replace('{before}', 'users')
        .replace('{after}', 'members')
    );

    const long = entriesOf(
      { memos: [{ id: 'm', value: 'a' }] },
      { memos: [{ id: 'm', value: 'x'.repeat(QUOTE_LIMIT + 5) }] }
    ).memos[0];
    expect(describeEntry(long, i18n)).toBe(
      `Modified\nContent: a → ${'x'.repeat(QUOTE_LIMIT)}…`
    );
  });

  it('takes the current pane alone to an addition, the saved pane alone to a removal, and both to the rest (AC-D11)', () => {
    expect(diffTargets(item(added))).toEqual({
      prev: null,
      next: { kind: 'table', tableId: 'added' },
    });
    expect(diffTargets(item(old))).toEqual({
      prev: { kind: 'table', tableId: 'old' },
      next: null,
    });
    expect(diffTargets(item(users.children[0], users))).toEqual({
      prev: { kind: 'table', tableId: 'users' },
      next: { kind: 'table', tableId: 'users' },
    });
    expect(diffTargets(item(orders.children[0], orders))).toEqual({
      prev: { kind: 'relationship', relationshipId: 'fk' },
      next: { kind: 'relationship', relationshipId: 'fk' },
    });
    expect(diffTargets(item(entries.memos[0]))).toEqual({
      prev: { kind: 'memo', memoId: 'm' },
      next: { kind: 'memo', memoId: 'm' },
    });
    expect(diffTargets(item(entries.tableGroups[0]))).toEqual({
      prev: { kind: 'tableGroup', tableGroupId: 'g' },
      next: { kind: 'tableGroup', tableGroupId: 'g' },
    });
    expect(diffTargets({ kind: 'folder', folder: 'memos', count: 1 })).toEqual({
      prev: null,
      next: null,
    });
    expect(diffTargets(item(users.children[0], null)).prev).toBeNull();
  });

  it('names a row by the current entity, or by the saved one where it is gone', () => {
    expect(entryNodeId(added)).toBe('t:added');
    expect(entryNodeId(old)).toBe('t:prev-old');
    expect(old.kind).toBe(DiffKind.table);
    expect(matchesFilter(old, ' OL ')).toBe(true);
    expect(matchesFilter(old, '')).toBe(true);
  });
});
