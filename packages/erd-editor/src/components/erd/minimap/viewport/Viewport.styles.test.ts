import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/minimap/viewport/Viewport.styles';

describe('Viewport.styles', () => {
  it('compiles `viewport` to a non empty class identifier', () => {
    expect(styles.viewport).toBeTruthy();
    expect(String(styles.viewport)).toMatch(/\S/);
  });

  it('positions the viewport box and marks it as draggable', () => {
    const source = styles.viewport.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain(
      'border: solid 1.5px var(--minimap-viewport-border)'
    );
    expect(source).toContain('cursor: pointer');
  });

  it('shares one highlight color between hover and the selected modifier', () => {
    const source = styles.viewport.strings.join('');

    expect(source).toContain('&:hover');
    expect(source).toContain('&.selected');
    expect(
      source.match(/border-color: var\(--minimap-viewport-border-hover\)/g)
    ).toHaveLength(2);
  });

  it('interpolates no runtime values', () => {
    expect(styles.viewport.values).toEqual([]);
  });
});
