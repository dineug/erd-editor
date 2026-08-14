import { describe, expect, it } from 'vitest';

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

  it('interpolates no runtime values', () => {
    expect(styles.root.values).toEqual([]);
  });
});
