import { range } from '@/helpers';
import { state, TreeNode } from '@/store/tree';

export function getCurrentNode(): TreeNode | null {
  return state.lastSelectNode;
}

export function orderByNameASC(a: TreeNode, b: TreeNode): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function rangeNodes(a: number, b: number, nodes: TreeNode[]) {
  return range(a, b).map(index => nodes[index]);
}
