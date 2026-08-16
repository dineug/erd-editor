import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/diff-viewer/tree-viewer/TreeViewer.styles';
import { DIFF_TREE_WIDTH } from '@/constants/layout';

describe('TreeViewer.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const names = [
      String(styles.root),
      String(styles.icon),
      String(styles.table),
      String(styles.column),
      String(styles.ellipsis),
    ];

    names.forEach(name => expect(name).toMatch(/\S/));
    expect(new Set(names).size).toBe(names.length);
  });

  it('locks the tree column to the shared DIFF_TREE_WIDTH constant', () => {
    const source = styles.root.strings.join('');

    expect(styles.root.values).toEqual([DIFF_TREE_WIDTH, DIFF_TREE_WIDTH]);
    expect(source).toContain('width: ');
    expect(source).toContain('min-width: ');
    expect(source).toContain('flex-direction: column');
    expect(source).toContain('overflow-x: hidden');
    expect(source).toContain('overflow-y: auto');
    expect(source).toContain(
      'background-color: var(--context-menu-background)'
    );
  });

  it('colours the icon per diff state through the diff custom properties', () => {
    const source = styles.icon.strings.join('');

    expect(source).toContain('&.diff-insert');
    expect(source).toContain('fill: var(--diff-insert-foreground)');
    expect(source).toContain('&.diff-delete');
    expect(source).toContain('fill: var(--diff-delete-foreground)');
    expect(source).toContain('&.diff-cross');
    expect(source).toContain('fill: var(--diff-cross-foreground)');
  });

  it('composes the shared clickable item rules into the row styles', () => {
    const [item] = styles.table.values as any[];

    expect(styles.table.values.length).toBe(1);
    expect(styles.column.values).toEqual([item]);
    expect(String(item)).toMatch(/\S/);

    const itemSource = (item as any).strings.join('');
    expect(itemSource).toContain('cursor: pointer');
    expect(itemSource).toContain('background-color: var(--context-menu-hover)');
    expect(itemSource).toContain('color: var(--active)');
  });

  it('gives the table row a taller box than the column row', () => {
    const tableSource = styles.table.strings.join('');
    const columnSource = styles.column.strings.join('');

    expect(tableSource).toContain('height: 36px');
    expect(tableSource).toContain('min-height: 36px');
    expect(tableSource).toContain('padding: 0 12px');
    expect(columnSource).toContain('height: 24px');
    expect(columnSource).toContain('min-height: 24px');
    expect(columnSource).toContain('padding: 0 12px 0 24px');
  });

  it('truncates overflowing labels with an ellipsis', () => {
    const source = styles.ellipsis.strings.join('');

    expect(source).toContain('overflow: hidden');
    expect(source).toContain('white-space: nowrap');
    expect(source).toContain('text-overflow: ellipsis');
    expect(styles.ellipsis.values).toEqual([]);
  });
});
