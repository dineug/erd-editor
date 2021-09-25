import { TreeNode, TreeNodeType } from '@/store/tree';
import data from '@/store/tree/mock.json';

export const createMock = () =>
  new TreeNode({
    node: {
      name: 'example',
      open: true,
      children: [
        new TreeNode({
          node: {
            name: 'okky',
            type: TreeNodeType.file,
            value: JSON.stringify(data),
          },
        }),
      ],
    },
  });
