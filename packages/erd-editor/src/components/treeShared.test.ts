// AC-T12: the Explorer and the diff viewer draw one tree, so a fix to its
// keys, its rows or its scrolling reaches both. A source scan holds them to
// the one component, since two lookalike trees would type-check as well.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const SOURCE_ROOT = join(process.cwd(), 'src');

const HOSTS = [
  'components/explorer/explorer-panel/ExplorerPanel.tsx',
  'components/erd/diff-viewer/diff-tree/DiffTree.tsx',
];

describe('the one tree', () => {
  it.each(HOSTS)('draws %s with the shared tree component', host => {
    const source = readFileSync(join(SOURCE_ROOT, host), 'utf8');

    expect(source).toMatch(
      /import Tree from '@\/components\/primitives\/tree\/Tree';/
    );
    expect(source).toContain('<Tree');
  });
});
