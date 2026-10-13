import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { seedExplorerDocument } from '@/__test-utils__/explorerSeed';
import type { AppContext } from '@/components/appContext';
import {
  flattenTree,
  type TreeNode,
} from '@/components/primitives/tree/treeModel';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import {
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';

import { buildExplorerTree, type ExplorerNode } from './explorerTree';

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
