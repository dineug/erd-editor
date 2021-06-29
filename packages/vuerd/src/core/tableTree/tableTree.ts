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
  openNodes: string[] = [];

  id: string;
  table: Table;
  open: boolean;
  selected: boolean;
  disabled: boolean;
  parent: TreeNode | null;
  children: TreeNode[];

  constructor(
    context: ERDEditorContext,
    id: string,
    table: Table,
    parent: TreeNode | null,
    children: TreeNode[] = []
  ) {
    this.context = context;

    this.id = id;
    this.table = table;
    this.open = false;
    this.selected = false;
    this.disabled = this.verifyParent(parent);
    this.parent = parent;
    this.children = children;

    findChildren(this.context, this);
    this.children.forEach(child => findChildren(this.context, child));
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
   * Toggles between open/closed state
   * @returns True if toggle was succesfull
   */
  toggleOpen(): boolean {
    if (this.disabled) return false;
    this.open = !this.open;
    return true;
  }

  /**
   * Toggles between selected/unselected state
   * @returns True if toggle was succesfull
   */
  toggleSelect(): boolean {
    if (this.disabled) return false;

    if (this.parent) this.selectChildren(this.parent, this.id, 'parent');
    else this.selectChildren(this, this.id, 'child');

    return true;
  }

  /**
   * Recursively traverses all nodes and toggles selected/unselected state if ID is matched
   * @param node Node to be traversed
   * @param id Id of table to select/unselect
   * @param traversing Direction of recursive traversing
   */
  selectChildren(node: TreeNode, id: string, traversing: 'parent' | 'child') {
    if (node.disabled) return;

    if (traversing === 'parent' && node.parent) {
      node.selectChildren(node.parent, id, 'parent');
      return;
    }

    if (node.id === id) {
      node.selected = !node.selected;
    }

    node.children.forEach(child => {
      node.selectChildren(child, id, 'child');
    });
  }
}

/**
 * Generates entire graph with root being the table with the most connections (or table if ID provided)
 * @param context Context of entire app
 * @param rootTableId (optional) Id of the root table
 * @returns Root node if found
 */
export const generateRoot = (
  context: ERDEditorContext,
  rootTableId: string = ''
): TreeNode | null => {
  if (context === null) return null;

  const { store } = context;
  const { tables } = store.tableState;

  if (!rootTableId)
    rootTableId = getTableMostRelationship(store.relationshipState);

  if (!rootTableId) rootTableId = tables[0]?.id || '';

  const rootTable = getData(tables, rootTableId);

  if (rootTable) {
    return new TreeNode(context, rootTableId, rootTable, null);
  } else {
    return null;
  }
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
        if (table) return new TreeNode(context, id, table, node);
        else return null;
      })
      .filter(child => child !== null) || [];
};
