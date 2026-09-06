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
  });

  /**
   * The thumbnail box is filled edge to edge by the stage container inside it,
   * which paints the canvas background, so a colour of its own here would never
   * show: the document has no boundary for the map to draw outside of.
   */
  it('paints no background of its own behind the stage', () => {
    expect(styles.minimap.strings.join('')).not.toContain('background-color');
  });

  /**
   * The thumbnail keeps the content's shape, so it seldom fills the square;
   * the frame paints the boundary colour behind it, or the scene under the
   * minimap would show through the letterbox.
   */
  it('draws the frame painted with the boundary colour, without capturing pointer events', () => {
    const source = styles.border.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('box-sizing: content-box');
    expect(source).toContain('pointer-events: none');
    expect(source).toContain('border: 1px solid var(--minimap-border)');
    // The negative spread is what keeps an opaque shadow colour from reading
    // as a slab under the frame.
    expect(source).toContain(
      'box-shadow: 0 1px 6px -3px var(--minimap-shadow)'
    );
    expect(source).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
    expect(source).not.toContain('background-color: transparent');
  });

  it('interpolates no runtime values into the minimap styles', () => {
    expect(styles.minimap.values).toEqual([]);
    expect(styles.border.values).toEqual([]);
  });
});
