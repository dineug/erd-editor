import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/canvas/canvas-svg/CanvasSvg.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('CanvasSvg.styles', () => {
  it('exports the root token as a css template', () => {
    expect(styles.root).toBeTruthy();
    expect(typeof styles.root.toString()).toBe('string');
    expect(styles.root.toString().length).toBeGreaterThan(0);
  });

  it('overlays the svg on the canvas without clipping', () => {
    const text = staticText(styles.root);
    expect(text).toContain('position: absolute');
    expect(text).toContain('top: 0');
    expect(text).toContain('left: 0');
    expect(text).toContain('overflow: visible');
  });

  it('strokes plain relationships with the foreign key color', () => {
    const text = staticText(styles.root);
    expect(text).toContain('.relationship {');
    expect(text).toContain('stroke: var(--key-fk)');
  });

  it('strokes identifying relationships with the primary foreign key color', () => {
    const text = staticText(styles.root);
    expect(text).toContain('.relationship.identification {');
    expect(text).toContain('stroke: var(--key-pfk)');
  });

  it('covers hover, [data-hover] and identifying [data-hover] with one rule', () => {
    const text = staticText(styles.root);
    expect(text).toContain('.relationship:hover');
    expect(text).toContain('.relationship[data-hover]');
    expect(text).toContain('.relationship.identification[data-hover]');
    expect(text).toContain('stroke: var(--relationship-hover)');
  });
});
