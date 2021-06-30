import { getData } from '@/core/helper';
import { Entry, ITreeNode } from '@/core/tableTree';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { RelationshipState } from '@@types/engine/store/relationship.state';
import { Table } from '@@types/engine/store/table.state';

/**
 * Single node of entire graph - represents one table with children as relationships
 */
export class TreeNode implements ITreeNode {
  context: ERDEditorContext;

  id: string;
  table: Table | null;
  open: boolean;
  selected: boolean;
  disabled: boolean;
  parent: TreeNode | null;
  children: TreeNode[];

  root: TreeNode | null;

  constructor(
    context: ERDEditorContext,
    id: string,
    table: Table | null,
    parent: TreeNode | null,
    root: TreeNode | null,
    children: TreeNode[] = []
  ) {
    this.context = context;

    this.id = id;
    this.table = table;
    this.open = false;
    this.disabled = this.verifyParent(parent);
    this.parent = parent;
    this.root = root;
    this.children = children;
    this.selected = this.verifySelected();
  }

  /**
   * Recursively searches through all predecessors of provided node to check if provided node was a distant predecessor of itself
   * @param node Node to be checked againts this
   * @returns True if found duplicate along the way
   */
  verifyParent(node: TreeNode | null): boolean {
    if (node && node.id === this.id) {
      return true;
    } else if (node?.parent) {
      return this.verifyParent(node.parent);
    } else {
      return false;
    }
  }

  /**
   * Checks if node should be selected
   * @returns True if any children of root with matching ID is selected
   */
  verifySelected(): boolean {
    if (!this.root) return false;
    if (this.disabled) return false;

    var isSelected = false;

    this.root?.children.forEach(child => {
      if (child.id === this.id && child.selected) {
        isSelected = true;
      }
    });

    return isSelected;
  }

  /**
   * Toggles between open/closed state
   * @returns True if toggle was succesfull
   */
  toggleOpen(): boolean {
    if (this.disabled) return false;
    this.open = !this.open;

    if (this.open) {
      findChildren(this.context, this);
    }
    return true;
  }

  /**
   * Toggles between selected/unselected state
   * @returns True if toggle was succesfull
   */
  toggleSelect(): boolean {
    if (this.disabled) return false;
    this.selectChildren(this.root, this.id, !this.selected);
    return true;
  }

  /**
   * Recursively traverses all nodes and toggles selected/unselected state if ID is matched
   * @param node Node to be traversed
   * @param id Id of table to select/unselect
   */
  selectChildren(node: TreeNode | null, id: string, selected: boolean) {
    if (!node) return;
    if (node.disabled) return;

    if (node.id === id) {
      node.selected = selected;
    }

    node.children.forEach(child => {
      node.selectChildren(child, id, selected);
    });
  }
}

/**
 * Generates entire graph with root being the table with the most connections (or table if ID provided)
 * @param context Context of entire app
 * @param rootTableId (optional) Id of the root table
 * @returns Root node if found
 */
export const generateRoot = (context: ERDEditorContext): TreeNode | null => {
  if (context === null) return null;

  const { store } = context;
  const { tables } = store.tableState;

  var root = new TreeNode(context, '', null, null, null);
  root.children.push(
    ...tables.map(table => {
      var node = new TreeNode(context, table.id, table, root, root);
      node.selected = true;
      return node;
    })
  );

  root.children.sort((a, b) => {
    if (!a.table || !b.table) return 0;
    if (a.table.name < b.table.name) return -1;
    if (a.table.name > b.table.name) return 1;
    return 0;
  });

  return root;
};

/**
 * Finds table with the most relationships
 * @param relationships All relationships
 * @returns Table with the most relationships
 */
export const getTableMostRelationship = ({
  relationships,
}: RelationshipState): string => {
  var histogram: { [id: string]: Entry } = {};

  relationships.forEach(rel => {
    const table1 = rel.end.tableId;
    const table2 = rel.start.tableId;
    if (!histogram[table1]) {
      histogram[table1] = new Entry(table1);
    }
    if (!histogram[table2]) {
      histogram[table2] = new Entry(table2);
    }

    histogram[table1].add();
    histogram[table2].add();
  });

  var max: Entry = new Entry('');
  for (const key in histogram) {
    if (max.count <= histogram[key].count) {
      max = histogram[key];
    }
  }

  return max.id;
};

/**
 * Recursively searches through nodes to find all children
 * @param context Context of entire app
 * @param node Single node to be traversed
 */
export const findChildren = (context: ERDEditorContext, node: TreeNode) => {
  if (node.disabled) return;
  const { tables } = context.store.tableState;

  // @ts-ignore
  var partnersIDs: string[] = [
    ...new Set(
      context.store.relationshipState.relationships
        .map(relation => {
          if (relation.end.tableId === node.id) return relation.start.tableId;
          else if (relation.start.tableId === node.id)
            return relation.end.tableId;
          else return null;
        })
        .filter(relation => relation !== null)
    ),
  ];

  // @ts-ignore
  node.children =
    partnersIDs
      .map(id => {
        const table = getData(tables, id);
        if (table) return new TreeNode(context, id, table, node, node.root);
        else return null;
      })
      .filter(child => child !== null) || [];
};
