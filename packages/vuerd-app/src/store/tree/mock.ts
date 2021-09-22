import { TreeNode, TreeNodeType } from '@/store/tree';

export const createMock = () =>
  new TreeNode({
    node: {
      name: 'vuerd-app',
      open: true,
      children: [
        new TreeNode({
          node: {
            name: '.git',
          },
        }),
        new TreeNode({
          node: {
            name: 'node_modules',
          },
        }),
        new TreeNode({
          node: {
            name: 'public',
            open: true,
            children: [
              new TreeNode({
                node: {
                  name: 'static',
                  children: [
                    new TreeNode({
                      node: {
                        name: 'logo.png',
                        type: TreeNodeType.file,
                      },
                    }),
                    new TreeNode({
                      node: {
                        name: 'mov_bbb.mp4',
                        type: TreeNodeType.file,
                      },
                    }),
                    new TreeNode({
                      node: {
                        name: 'flower.mp4',
                        type: TreeNodeType.file,
                      },
                    }),
                  ],
                },
              }),
              new TreeNode({
                node: {
                  name: 'index.html',
                  type: TreeNodeType.file,
                },
              }),
            ],
          },
        }),
        new TreeNode({
          node: {
            name: '.gitignore',
            type: TreeNodeType.file,
          },
        }),
        new TreeNode({
          node: {
            name: 'README.md',
            type: TreeNodeType.file,
          },
        }),
        new TreeNode({
          node: {
            name: 'package.json',
            type: TreeNodeType.file,
          },
        }),
        new TreeNode({
          node: {
            name: 'yarn.lock',
            type: TreeNodeType.file,
          },
        }),
      ],
    },
  });
