import { v4 as uuid } from 'uuid';
import { reactive } from 'vue';

import { createStore } from '@/store';
import * as actions from '@/store/tree/actions';
import { createMock } from '@/store/tree/mock';

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
}

export enum TreeNodeType {
  root = 'root',
  folder = 'folder',
  file = 'file',
}

export class TreeNode {
  id = uuid();
  name = '';
  children: TreeNode[] = [];
  parent: TreeNode | null = null;
  open = false;
  edit = false;
  value = '';
  type = TreeNodeType.folder;

  constructor({ node }: Partial<LoadData> = {}) {
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

const isDev = import.meta.env.DEV;

if (isDev) {
  state.root = actions.setParent(createMock());
}

export const useTreeStore = createStore(state, actions, 'tree');
