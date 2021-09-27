import { v4 as uuid } from 'uuid';
import { reactive } from 'vue';

import { createStore } from '@/store';
import { TreeNode } from '@/store/tree';
import { getPath } from '@/store/tree/helper';
import * as actions from '@/store/view/actions';

export interface State {
  root: ViewNode;
  draggableTab: Tab | null;
  focusView: ViewNode | null;
  previewTab: Tab | null;
}

interface LoadData {
  node: Partial<ViewNode>;
}

export class ViewNode {
  readonly id = uuid();
  vertical = true;
  horizontal = false;
  width = 0;
  height = 0;
  widthRatio = 1;
  heightRatio = 1;
  parent: ViewNode | null = null;
  children: ViewNode[] = [];
  tabs: Tab[] = [];

  constructor({ node }: Partial<LoadData> = {}) {
    node && Object.assign(this, node);
  }

  *[Symbol.iterator](): Generator<ViewNode> {
    yield this;
    for (const node of this.children) yield* node;
  }
}

export class Tab {
  treeNode: TreeNode;
  viewNode: ViewNode | null = null;
  active = false;

  get id() {
    return this.treeNode.id;
  }

  get name() {
    return this.treeNode.name;
  }

  get path() {
    return getPath(this.treeNode).reverse().join('/');
  }

  constructor(treeNode: TreeNode) {
    this.treeNode = treeNode;
  }

  setTreeNode(treeNode: TreeNode) {
    this.treeNode = treeNode;
  }
}

export const state = reactive<State>({
  root: new ViewNode(),
  draggableTab: null,
  focusView: null,
  previewTab: null,
});

export const useViewStore = createStore(state, actions, 'view');
