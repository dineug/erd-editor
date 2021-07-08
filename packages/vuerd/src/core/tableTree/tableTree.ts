import { getData } from '@/core/helper';
import { ITreeNode } from '@/core/tableTree';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { Relationship } from '@@types/engine/store/relationship.state';
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
   * @returns True if table is visible
   */
  verifySelected(): boolean {
    if (!this.root) return false;
    if (this.disabled) return false;

    return this.table?.visible ? true : false;
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
      node.setSelected(selected);
    }

    node.children.forEach(child => {
      node.selectChildren(child, id, selected);
    });
  }

  /**
   * Setter for selected
   */
  setSelected(selected: boolean) {
    this.selected = selected;

    if (this.table && this.parent === this.root) {
      this.table.visible = selected;
      this.showRelationships(selected);
    }
  }

  showRelationships(visible: boolean) {
    const relationships = this.context.store.relationshipState.relationships;
    const tables = this.context.store.tableState.tables;

    relationships.forEach(relationship => {
      if (
        relationship.end.tableId === this.id ||
        relationship.start.tableId === this.id
      ) {
        if (visible) {
          if (relationship.end.tableId === this.id) {
            const startTable = getData(tables, relationship.start.tableId);
            relationship.visible = startTable?.visible ? true : false;
          } else {
            const endTable = getData(tables, relationship.end.tableId);
            relationship.visible = endTable?.visible ? true : false;
          }
        } else {
          relationship.visible = false;
        }
      }
    });
  }

  /**
   * Gets all relationships inside editor of this node
   * @returns Relationships inside editor
   */
  getRelationships(): Relationship[] {
    // @ts-ignore
    var relationships: Relationship[] =
      this.context.store.relationshipState.relationships
        .map(relationship => {
          if (
            relationship.start.tableId === this.id ||
            relationship.end.tableId === this.id
          ) {
            return relationship;
          } else {
            return null;
          }
        })
        .filter(value => value !== null);

    return relationships || [];
  }
}

/**
 * Generates entire graph with root having all tables as children
 * @param context Context of entire app
 * @returns Root node if found
 */
export const generateRoot = (context: ERDEditorContext): TreeNode => {
  const { store } = context;
  const { tables } = store.tableState;

  var root = new TreeNode(context, '', null, null, null);
  root.children.push(
    ...tables.map(table => {
      var node = new TreeNode(context, table.id, table, root, root);
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
 * Searches through relationships to find all related children
 * @param context Context of entire app
 * @param node Single
 */
export const findChildren = (context: ERDEditorContext, node: TreeNode) => {
  if (node.disabled || !node.root) return;

  // @ts-ignore
  var childrenIDs: string[] = [
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
    childrenIDs
      .map(id => {
        if (node.root) var child = getData(node.root.children, id);
        if (child)
          return new TreeNode(context, id, child.table, node, node.root);
        else return null;
      })
      .filter(child => child !== null) || [];
};
