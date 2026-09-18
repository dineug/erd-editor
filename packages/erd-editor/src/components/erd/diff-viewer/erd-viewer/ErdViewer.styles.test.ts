import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/diff-viewer/erd-viewer/ErdViewer.styles';

describe('ErdViewer.styles', () => {
  it('compiles the root export to a non empty class identifier', () => {
    expect(String(styles.root)).toMatch(/\S/);
  });

  it('fills its parent and becomes the positioning context for overlays', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('display: flex');
    expect(source).toContain('width: 100%');
    expect(source).toContain('height: 100%');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain('position: relative');
  });

  it('takes every touch itself, so a pinch zooms the pane and not the page', () => {
    expect(styles.root.strings.join('')).toContain('touch-action: none');
  });

  it('interpolates no runtime values', () => {
    expect(styles.root.values).toEqual([]);
  });
});
