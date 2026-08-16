import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/diff-viewer/DiffViewer.styles';

describe('DiffViewer.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    expect(String(styles.root)).toMatch(/\S/);
    expect(String(styles.container)).toMatch(/\S/);
    expect(String(styles.viewport)).toMatch(/\S/);
    expect(String(styles.root)).not.toBe(String(styles.container));
    expect(String(styles.container)).not.toBe(String(styles.viewport));
  });

  it('pins the root overlay to the top left corner of the canvas', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('top: 0');
    expect(source).toContain('left: 0');
    expect(source).toContain('width: 100%');
    expect(source).toContain('height: 100%');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
  });

  it('lays the container out as a full size relative flex row', () => {
    const source = styles.container.strings.join('');

    expect(source).toContain('display: flex');
    expect(source).toContain('position: relative');
    expect(source).toContain('width: 100%');
    expect(source).toContain('height: 100%');
    expect(source).toContain('overflow: hidden');
  });

  it('splits each viewport in half with a divider border', () => {
    const source = styles.viewport.strings.join('');

    expect(source).toContain('width: 50%');
    expect(source).toContain('height: 100%');
    expect(source).toContain(
      'border-left: 1px solid var(--context-menu-border)'
    );
  });

  it('interpolates no runtime values', () => {
    expect(styles.root.values).toEqual([]);
    expect(styles.container.values).toEqual([]);
    expect(styles.viewport.values).toEqual([]);
  });
});
