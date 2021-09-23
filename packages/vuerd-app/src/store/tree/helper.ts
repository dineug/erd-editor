import { range } from '@/helpers';
import { state, TreeNode, TreeNodeType } from '@/store/tree';

export const getCurrentNode = (): TreeNode | null => state.lastSelectNode;

export const orderByNameASC = (a: TreeNode, b: TreeNode): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

export const rangeNodes = (a: number, b: number, nodes: TreeNode[]) =>
  range(a, b).map(index => nodes[index]);

export const createFileNode = () =>
  new TreeNode({
    node: { type: TreeNodeType.file, edit: true },
  });

export const createFolderNode = () =>
  new TreeNode({
    node: { type: TreeNodeType.folder, edit: true },
  });

export function getPath(node: TreeNode, paths: string[] = []) {
  node.name && paths.push(node.name);
  node.parent && getPath(node.parent, paths);
  return paths;
}
