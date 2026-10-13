/**
 * One node of a tree a host builds. Its children are asked for only while it
 * is expanded, so a host can hand over a large document without building rows
 * for what stays folded.
 */
export type TreeNode<T = unknown> = {
  id: string;
  hasChildren: boolean;
  children: () => ReadonlyArray<TreeNode<T>>;
  data: T;
};

/** A node as the tree lays it out: its depth and its place among its siblings. */
export type TreeRow<T = unknown> = {
  node: TreeNode<T>;
  /** One for a root. */
  level: number;
  setSize: number;
  /** One for the first sibling. */
  posInSet: number;
  expanded: boolean;
  parentId: string | null;
};

export type ExpandedIds = Readonly<Record<string, true>>;

/** The rows a tree shows: every root, and the children of each expanded node, depth first. */
export function flattenTree<T>(
  roots: ReadonlyArray<TreeNode<T>>,
  expanded: ExpandedIds
): TreeRow<T>[] {
  const rows: TreeRow<T>[] = [];

  const visit = (
    nodes: ReadonlyArray<TreeNode<T>>,
    level: number,
    parentId: string | null
  ) => {
    nodes.forEach((node, index) => {
      const open = node.hasChildren && expanded[node.id] === true;
      rows.push({
        node,
        level,
        setSize: nodes.length,
        posInSet: index + 1,
        expanded: open,
        parentId,
      });
      if (open) visit(node.children(), level + 1, node.id);
    });
  };

  visit(roots, 1, null);
  return rows;
}

/** What a key asks of the tree: move the active row, or fold or unfold one. */
export type TreeMove =
  | { type: 'focus'; id: string; index: number }
  | { type: 'toggle'; id: string; expanded: boolean };

/**
 * Reads a tree key the way the WAI-ARIA tree pattern does. Up and Down step,
 * Home and End go to either end, the inline end unfolds or steps into the
 * first child and the inline start folds or steps out, mirrored right to left.
 */
export function moveFocus<T>(
  rows: ReadonlyArray<TreeRow<T>>,
  activeId: string | null,
  key: string,
  dir: 'ltr' | 'rtl' = 'ltr'
): TreeMove | null {
  if (!rows.length) return null;

  const focus = (index: number): TreeMove => ({
    type: 'focus',
    id: rows[index].node.id,
    index,
  });
  const index = rows.findIndex(row => row.node.id === activeId);
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';

  if (key === 'Home') return focus(0);
  if (key === 'End') return focus(rows.length - 1);
  if (index === -1) {
    return key === 'ArrowDown' || key === 'ArrowUp' ? focus(0) : null;
  }

  const row = rows[index];

  switch (key) {
    case 'ArrowDown':
      return index < rows.length - 1 ? focus(index + 1) : null;
    case 'ArrowUp':
      return index > 0 ? focus(index - 1) : null;
    case forward:
      if (!row.node.hasChildren) return null;
      if (!row.expanded) {
        return { type: 'toggle', id: row.node.id, expanded: true };
      }
      return rows[index + 1]?.parentId === row.node.id
        ? focus(index + 1)
        : null;
    case backward: {
      if (row.expanded) {
        return { type: 'toggle', id: row.node.id, expanded: false };
      }
      if (row.parentId === null) return null;
      const parent = rows.findIndex(({ node }) => node.id === row.parentId);
      return parent === -1 ? null : focus(parent);
    }
    default:
      return null;
  }
}
