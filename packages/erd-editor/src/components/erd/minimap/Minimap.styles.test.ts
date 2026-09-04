import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/minimap/Minimap.styles';

describe('Minimap.styles', () => {
  it('compiles every export to a non empty class identifier', () => {
    expect(String(styles.minimap)).toMatch(/\S/);
    expect(String(styles.border)).toMatch(/\S/);
    expect(String(styles.minimap)).not.toBe(String(styles.border));
  });

  it('clips the minimap to its own absolutely positioned box', () => {
    const source = styles.minimap.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
  });

  it('draws the border overlay without capturing pointer events', () => {
    const source = styles.border.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('box-sizing: content-box');
    expect(source).toContain('pointer-events: none');
    expect(source).toContain('border: 1px solid var(--minimap-border)');
    expect(source).toContain('box-shadow: 0 1px 6px var(--minimap-shadow)');
    expect(source).toContain('background-color: transparent');
  });

  it('interpolates no runtime values into the minimap styles', () => {
    expect(styles.minimap.values).toEqual([]);
    expect(styles.border.values).toEqual([]);
  });
});
