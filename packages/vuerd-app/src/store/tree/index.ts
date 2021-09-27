import { v4 as uuid } from 'uuid';
import { reactive } from 'vue';

import { Node } from '@/core/indexedDB';
import { createStore } from '@/store';
import * as actions from '@/store/tree/actions';

export interface State {
  root: TreeNode;
  focus: boolean;
  selectNodes: TreeNode[];
  lastSelectNode: TreeNode | null;
  oldName: string;
  newNode: TreeNode | null;
}

interface LoadData {
  node: Partial<TreeNode>;
  treeNode: Node;
}

export enum TreeNodeType {
  root = 'root',
  folder = 'folder',
  file = 'file',
}

export class TreeNode {
  readonly id = uuid();
  name = '';
  open = false;
  edit = false;
  value = '';
  type = TreeNodeType.folder;
  parent: TreeNode | null = null;
  children: TreeNode[] = [];

  constructor({ node, treeNode }: Partial<LoadData> = {}) {
    if (treeNode) {
      Object.assign(this, treeNode);
      this.children = treeNode.children.map(
        childNode => new TreeNode({ treeNode: childNode })
      );
    }

    node && Object.assign(this, node);
  }

  *[Symbol.iterator](): Generator<TreeNode> {
    yield this;
    for (const node of this.children) yield* node;
  }

  *iterVisible(): Generator<TreeNode> {
    yield this;
    if (!this.open) return;

    for (const node of this.children) {
      yield* node.iterVisible();
    }
  }
}

export const state = reactive<State>({
  root: new TreeNode({
    node: {
      name: 'root',
      type: TreeNodeType.root,
      open: true,
    },
  }),
  focus: false,
  selectNodes: [],
  lastSelectNode: null,
  oldName: '',
  newNode: null,
});

export const useTreeStore = createStore(state, actions, 'tree');
