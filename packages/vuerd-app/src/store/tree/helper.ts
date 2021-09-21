import { state, TreeNode } from '@/store/tree';

export function getCurrentNode(): TreeNode | null {
  return state.lastSelectNode;
}

export function orderByNameASC(a: TreeNode, b: TreeNode): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
