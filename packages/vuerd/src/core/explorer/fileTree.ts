import { Entry, ITreeNode } from '@/core/explorer/';
import { getData } from '@/core/helper';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { RelationshipState } from '@@types/engine/store/relationship.state';
import { Table, TableState } from '@@types/engine/store/table.state';

export class TreeNode implements ITreeNode {
  id: string;
  table: Table;
  open: boolean;
  disabled: boolean;
  parent: TreeNode | null;
  children: TreeNode[];

  constructor(
    id: string,
    table: Table,
    parent: TreeNode | null,
    children: TreeNode[] = []
  ) {
    this.id = id;
    this.table = table;
    this.open = false;
    this.disabled = this.verifyParent(parent);
    this.parent = parent;
    this.children = children;
  }

  verifyParent(node: TreeNode | null): boolean {
    if (node && node.id === this.id) {
      return true;
    } else if (node?.parent) {
      return this.verifyParent(node.parent);
    } else {
      return false;
    }
  }
}

export const generateRoot = (
  context: ERDEditorContext,
  rootTableId: string = ''
): TreeNode | null => {
  const { store } = context;
  const { tables } = store.tableState;

  if (!rootTableId)
    rootTableId = getTableMostRelationship(store.relationshipState);

  const rootTable = getData(tables, rootTableId);

  if (rootTable) {
    return new TreeNode(rootTableId, rootTable, null);
  } else {
    return null;
  }
};

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

  console.log(histogram);

  var max: Entry = new Entry('');
  for (const key in histogram) {
    if (max.count <= histogram[key].count) {
      max = histogram[key];
    }
  }

  return max.id;
};

export const openNode = (context: ERDEditorContext, node: TreeNode) => {
  if (node.disabled) return;

  const { tables } = context.store.tableState;

  node.open = true;

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
        if (table) return new TreeNode(id, table, node);
        else return null;
      })
      .filter(child => child !== null) || [];

  // todo delete vvvvvv
  console.log(partnersIDs);

  console.log(node);

  let btn = document.createElement('button');
  btn.innerHTML = node.table.name;
  btn.style.color = 'blue';
  document.body.appendChild(btn);

  node.children.forEach(child => {
    let btn = document.createElement('button');
    btn.innerHTML = child.table.name;
    if (child.disabled) btn.style.color = 'red';
    btn.addEventListener('click', function () {
      openNode(context, child);
    });
    document.body.appendChild(btn);
  });
  // up until here ^^^^^^
};
