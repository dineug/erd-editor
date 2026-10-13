import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { seedExplorerDocument } from '@/__test-utils__/explorerSeed';
import type { AppContext } from '@/components/appContext';
import {
  flattenTree,
  type TreeNode,
} from '@/components/primitives/tree/treeModel';
import { Show } from '@/constants/schema';
import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import {
  changeTableCommentAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';
import {
  createMatcher,
  FindFieldList,
  findMatches,
  treeOrderOf,
} from '@/utils/find-replace';

import {
  buildExplorerTree,
  buildSearchTree,
  type ExplorerNode,
  matchRowId,
  searchExpanded,
} from './explorerTree';

let app: AppContext;

beforeEach(() => {
  app = createTestAppContext();
  seedExplorerDocument(app);
});

afterEach(() => {
  app.store.destroy();
});

/** Every row with every node expanded, as an id and what it stands for. */
function rowsOpen(): Array<[string, ExplorerNode]> {
  const expanded: Record<string, true> = {};
  const open = (nodes: ReadonlyArray<TreeNode<ExplorerNode>>) =>
    nodes.forEach(node => {
      expanded[node.id] = true;
      if (node.hasChildren) open(node.children());
    });
  const roots = buildExplorerTree(app.store.state);
  open(roots);
  return flattenTree(roots, expanded).map(row => [row.node.id, row.node.data]);
}

const ids = () => rowsOpen().map(([id]) => id);
const nodeOf = (id: string) => rowsOpen().find(([at]) => at === id)?.[1];

describe('buildExplorerTree', () => {
  it('lays out Tables, Table Groups and Memos, each table with its own folders (AC-T1)', () => {
    expect(ids()).toEqual([
      'f:tables',
      't:apple',
      't:orders',
      't:orders/f:columns',
      'c:orders.id',
      'c:orders.user_id',
      'c:orders.total',
      't:orders/f:indexes',
      'i:idx',
      't:orders/f:foreignKeys',
      'r:rel',
      't:users',
      't:users/f:columns',
      'c:users.id',
      'c:users.email',
      'f:tableGroups',
      'g:empty',
      'g:billing',
      'g:billing/t:orders',
      'f:memos',
      'm:note',
    ]);
  });

  it('counts each folder by the rows it holds (AC-T2)', () => {
    expect(nodeOf('f:tables')).toEqual({
      kind: 'folder',
      folder: 'tables',
      count: 3,
    });
    expect(nodeOf('t:orders/f:columns')).toMatchObject({ count: 3 });
    expect(nodeOf('f:tableGroups')).toMatchObject({ count: 2 });
  });

  it('marks a key column, and carries the data type (AC-T3)', () => {
    expect(nodeOf('c:orders.id')).toMatchObject({
      name: 'id',
      dataType: 'BIGINT',
      primaryKey: true,
      foreignKey: false,
    });
    expect(nodeOf('c:orders.user_id')).toMatchObject({
      primaryKey: false,
      foreignKey: true,
    });
    expect(nodeOf('c:users.email')).toMatchObject({
      primaryKey: false,
      foreignKey: false,
    });
  });

  it('writes an index with its columns in key order, and a foreign key by its columns and parent (AC-T4)', () => {
    expect(nodeOf('i:idx')).toMatchObject({
      name: 'orders_user_idx',
      unique: true,
      columns: 'user_id DESC, total',
    });
    expect(nodeOf('r:rel')).toMatchObject({
      columns: 'user_id',
      parent: 'users',
      parentColumns: 'id',
    });
  });

  it('shows the foreign keys a table is the child of alone', () => {
    expect(ids()).not.toContain('t:users/f:foreignKeys');
  });

  it('lists the tables of a group as rows that go to them, and a memo by its first line (AC-T5)', () => {
    expect(nodeOf('g:billing/t:orders')).toEqual({
      kind: 'groupTable',
      tableGroupId: 'billing',
      tableId: 'orders',
      name: 'orders',
    });
    expect(nodeOf('g:billing')).toMatchObject({ color: '#ff0000' });
    expect(nodeOf('m:note')).toEqual({
      kind: 'memo',
      memoId: 'note',
      text: 'Order states',
    });
  });

  it('orders tables and groups by name, any case, and memos as the document has them (AC-T6)', () => {
    const order = ids().filter(id => /^[tg]:[^/]+$/.test(id));

    expect(order).toEqual([
      't:apple',
      't:orders',
      't:users',
      'g:empty',
      'g:billing',
    ]);
  });

  it('leaves out the groups and the memos View Option hides (AC-T7)', () => {
    app.store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: true }),
      changeShowAction({ show: Show.hideMemo, value: true })
    );

    expect(ids().filter(id => id.startsWith('f:'))).toEqual(['f:tables']);
  });

  it('builds again from the state as it stands, with no folder left empty (AC-T9)', () => {
    app.store.dispatchSync(
      changeTableNameAction({ id: 'apple', value: 'zebra' }),
      removeTableAction({ id: 'users' })
    );

    expect(ids().filter(id => /^t:[^/]+$/.test(id))).toEqual([
      't:orders',
      't:apple',
    ]);
    expect(ids()).not.toContain('t:orders/f:foreignKeys');
  });

  it('asks a table for its folders only once it is expanded', () => {
    const roots = buildExplorerTree(app.store.state);
    const rows = flattenTree(roots, { 'f:tables': true });

    expect(rows.map(row => row.node.id)).toEqual([
      'f:tables',
      't:apple',
      't:orders',
      't:users',
      'f:tableGroups',
      'f:memos',
    ]);
    // Apple has no columns, indexes or keys, so it opens on nothing.
    expect(rows[1].node.children()).toEqual([]);
  });
});

describe('buildSearchTree', () => {
  const matchesOf = (query: string) =>
    findMatches(
      app.store.state,
      createMatcher(query, {
        matchCase: false,
        wholeWord: false,
        regex: false,
      }).matcher!,
      FindFieldList,
      treeOrderOf(app.store.state)
    );

  /** The rows a search shows, every one open but those folded. */
  const searchRows = (query: string, collapsed: Record<string, true> = {}) => {
    const matches = matchesOf(query);
    const tree = buildSearchTree(app.store.state, matches);
    return flattenTree(tree.roots, searchExpanded(tree.branchIds, collapsed));
  };
  const searchIds = (query: string, collapsed?: Record<string, true>) =>
    searchRows(query, collapsed).map(row => row.node.id);

  it('shows the matches and the rows above them alone, an index under its table (AC-Q3, AC-Q4)', () => {
    expect(searchIds('order')).toEqual([
      'f:tables',
      't:orders',
      't:orders/f:indexes',
      'i:idx',
      'f:memos',
      'm:note',
      'm:note/x:memo:0',
    ]);
  });

  it('marks a name on its own row, with every match found in it', () => {
    const rows = searchRows('order');
    const node = (id: string) => rows.find(row => row.node.id === id)?.node;

    expect(node('t:orders')?.data).toMatchObject({
      kind: 'table',
      matches: [{ field: 'tableName', start: 0, end: 5 }],
    });
    expect(node('i:idx')?.data).toMatchObject({
      kind: 'index',
      columns: 'user_id DESC, total',
      matches: [{ field: 'indexName', start: 0, end: 5 }],
    });
  });

  it('gives each match in a comment or a memo a row of its own (N-k)', () => {
    app.store.dispatchSync(
      changeTableCommentAction({ id: 'users', value: 'orders placed' }),
      changeColumnCommentAction({
        id: 'users.email',
        tableId: 'users',
        value: 'the order mail',
      }),
      changeMemoValueAction({ id: 'note', value: 'order one, order two' })
    );

    expect(searchIds('order')).toEqual([
      'f:tables',
      't:orders',
      't:orders/f:indexes',
      'i:idx',
      't:users',
      't:users/x:tableComment:0',
      't:users/f:columns',
      'c:users.email',
      'c:users.email/x:columnComment:4',
      'f:memos',
      'm:note',
      'm:note/x:memo:0',
      'm:note/x:memo:11',
    ]);
  });

  it('counts a folder by the rows it shows (N-e)', () => {
    const tables = searchRows('order').find(row => row.node.id === 'f:tables');

    expect(tables?.node.data).toEqual({
      kind: 'folder',
      folder: 'tables',
      count: 1,
    });
  });

  /** An owner decision of 2026-10-13: a table found shows under Tables alone. */
  it('leaves the tables of a group out, a group found standing alone (#8)', () => {
    expect(searchIds('orders')).not.toContain('g:billing/t:orders');
    expect(searchIds('bill')).toEqual(['f:tableGroups', 'g:billing']);
    expect(searchRows('bill')[1].node.hasChildren).toBe(false);
  });

  it('shows every row with children open but those folded', () => {
    expect(searchIds('order', { 't:orders': true })).toEqual([
      'f:tables',
      't:orders',
      'f:memos',
      'm:note',
      'm:note/x:memo:0',
    ]);
  });

  it('puts every match on the row matchRowId names', () => {
    app.store.dispatchSync(
      changeTableCommentAction({ id: 'users', value: 'orders placed' })
    );
    const ids = searchIds('order');

    for (const match of matchesOf('order')) {
      expect(ids).toContain(matchRowId(match));
    }
  });

  it('leaves out a match a removal has left behind, until the search the edit asks for', () => {
    const matches = matchesOf('order');
    app.store.dispatchSync(removeTableAction({ id: 'orders' }));

    const tree = buildSearchTree(app.store.state, matches);

    expect(tree.roots.map(node => node.id)).toEqual(['f:memos']);
  });
});
