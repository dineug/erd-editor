import { describe, expect, it, vi } from 'vite-plus/test';

import {
  type ExpandedIds,
  flattenTree,
  moveFocus,
  type TreeNode,
} from './treeModel';

const leaf = (id: string): TreeNode<null> => ({
  id,
  hasChildren: false,
  children: () => [],
  data: null,
});

const branch = (id: string, kids: TreeNode<null>[]): TreeNode<null> => ({
  id,
  hasChildren: true,
  children: () => kids,
  data: null,
});

/** tables: users (id, name), orders (id); memos: note */
const tree = () => [
  branch('tables', [
    branch('users', [leaf('users.id'), leaf('users.name')]),
    branch('orders', [leaf('orders.id')]),
  ]),
  branch('memos', [leaf('note')]),
];

const ids = (expanded: ExpandedIds) =>
  flattenTree(tree(), expanded).map(row => row.node.id);

describe('flattenTree', () => {
  it('shows the roots alone while nothing is expanded', () => {
    expect(ids({})).toEqual(['tables', 'memos']);
  });

  it('shows the children of each expanded node, depth first', () => {
    expect(ids({ tables: true, users: true })).toEqual([
      'tables',
      'users',
      'users.id',
      'users.name',
      'orders',
      'memos',
    ]);
  });

  it('asks a node for its children only while it is expanded', () => {
    const children = vi.fn(() => [leaf('a')]);
    const roots = [
      { id: 'root', hasChildren: true, children, data: null },
    ] satisfies TreeNode<null>[];

    flattenTree(roots, {});
    expect(children).not.toHaveBeenCalled();

    flattenTree(roots, { root: true });
    expect(children).toHaveBeenCalledTimes(1);
  });

  it('gives each row its level, its place among its siblings and its parent', () => {
    const rows = flattenTree(tree(), { tables: true, users: true });
    const name = rows.find(row => row.node.id === 'users.name')!;
    const users = rows.find(row => row.node.id === 'users')!;

    expect(name).toMatchObject({
      level: 3,
      setSize: 2,
      posInSet: 2,
      expanded: false,
      parentId: 'users',
    });
    expect(users).toMatchObject({
      level: 2,
      setSize: 2,
      posInSet: 1,
      expanded: true,
      parentId: 'tables',
    });
  });

  it('never expands a leaf, whatever the record says', () => {
    const rows = flattenTree([leaf('only')], { only: true });

    expect(rows).toHaveLength(1);
    expect(rows[0].expanded).toBe(false);
  });
});

describe('moveFocus', () => {
  const rows = flattenTree(tree(), { tables: true, users: true });

  it('steps up and down and stops at either end', () => {
    expect(moveFocus(rows, 'users', 'ArrowDown')).toEqual({
      type: 'focus',
      id: 'users.id',
      index: 2,
    });
    expect(moveFocus(rows, 'users', 'ArrowUp')).toMatchObject({
      id: 'tables',
    });
    expect(moveFocus(rows, 'memos', 'ArrowDown')).toBeNull();
    expect(moveFocus(rows, 'tables', 'ArrowUp')).toBeNull();
  });

  it('goes to either end on Home and End', () => {
    expect(moveFocus(rows, 'users.id', 'Home')).toMatchObject({
      id: 'tables',
    });
    expect(moveFocus(rows, 'users.id', 'End')).toMatchObject({
      id: 'memos',
      index: rows.length - 1,
    });
  });

  it('starts at the first row when no row is active', () => {
    expect(moveFocus(rows, null, 'ArrowDown')).toMatchObject({ id: 'tables' });
    expect(moveFocus(rows, 'gone', 'ArrowUp')).toMatchObject({ id: 'tables' });
    expect(moveFocus(rows, null, 'ArrowRight')).toBeNull();
  });

  it('unfolds a folded node on the inline end, then steps into its first child', () => {
    expect(moveFocus(rows, 'orders', 'ArrowRight')).toEqual({
      type: 'toggle',
      id: 'orders',
      expanded: true,
    });
    expect(moveFocus(rows, 'users', 'ArrowRight')).toMatchObject({
      type: 'focus',
      id: 'users.id',
    });
    expect(moveFocus(rows, 'users.id', 'ArrowRight')).toBeNull();
  });

  it('folds an unfolded node on the inline start, or steps out to its parent', () => {
    expect(moveFocus(rows, 'users', 'ArrowLeft')).toEqual({
      type: 'toggle',
      id: 'users',
      expanded: false,
    });
    expect(moveFocus(rows, 'users.name', 'ArrowLeft')).toMatchObject({
      type: 'focus',
      id: 'users',
    });
    expect(moveFocus(rows, 'memos', 'ArrowLeft')).toBeNull();
  });

  it('mirrors the inline keys right to left', () => {
    expect(moveFocus(rows, 'orders', 'ArrowLeft', 'rtl')).toEqual({
      type: 'toggle',
      id: 'orders',
      expanded: true,
    });
    expect(moveFocus(rows, 'users.name', 'ArrowRight', 'rtl')).toMatchObject({
      id: 'users',
    });
  });

  it('answers nothing on an empty tree or a key it does not read', () => {
    expect(moveFocus([], null, 'ArrowDown')).toBeNull();
    expect(moveFocus(rows, 'users', 'Enter')).toBeNull();
  });

  it('steps into no child an unfolded node did not bring', () => {
    const empty = flattenTree([branch('empty', [])], { empty: true });

    expect(moveFocus(empty, 'empty', 'ArrowRight')).toBeNull();
  });

  it('steps out to no parent the rows no longer hold', () => {
    const orphan = flattenTree(tree(), { tables: true, users: true }).slice(2);

    expect(moveFocus(orphan, 'users.id', 'ArrowLeft')).toBeNull();
  });
});
