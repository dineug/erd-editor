import { v4 as uuid } from 'uuid';
import { reactive } from 'vue';

import { createStore } from '@/store';
import * as actions from '@/store/tree/actions';
import { createMock } from '@/store/tree/mock';

interface LoadData {
  node: Partial<TreeNode>;
}

export class TreeNode {
  id = uuid();
  name = '';
  children: TreeNode[] = [];
  parent: TreeNode | null = null;
  open = false;
  edit = false;
  value = '';
  type: 'folder' | 'file' = 'folder';

  constructor({ node }: Partial<LoadData> = {}) {
    node && Object.assign(this, node);
  }

  *[Symbol.iterator](): Generator<TreeNode> {
    yield this;
    for (const node of this.children) yield* node;
  }
}

export const state = reactive({
  root: new TreeNode({ node: { open: true, children: [createMock()] } }),
});

export const useTreeStore = createStore(state, actions);
