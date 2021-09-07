import { v4 as uuid } from 'uuid';
import { reactive } from 'vue';

import { createStore } from '@/store';
import * as actions from '@/store/tree/actions';

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

  constructor({ node }: Partial<LoadData> = {}) {
    node && Object.assign(this, node);
  }
}

export const state = reactive({
  root: new TreeNode({ node: { open: true } }),
});

export const useTreeStore = createStore(state, actions);
