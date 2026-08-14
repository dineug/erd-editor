import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/canvas/draw-relationship/DrawRelationship.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('DrawRelationship.styles', () => {
  it('exports the root token as a css template', () => {
    expect(styles.root).toBeTruthy();
    expect(typeof styles.root.toString()).toBe('string');
    expect(styles.root.toString().length).toBeGreaterThan(0);
  });

  it('overlays the preview svg on the canvas without clipping', () => {
    const text = staticText(styles.root);
    expect(text).toContain('position: absolute');
    expect(text).toContain('top: 0');
    expect(text).toContain('left: 0');
    expect(text).toContain('overflow: visible');
  });

  it('lets pointer events through so the drag keeps tracking the canvas', () => {
    expect(staticText(styles.root)).toContain('pointer-events: none');
  });

  it('strokes the preview with the foreign key color', () => {
    expect(staticText(styles.root)).toContain('stroke: var(--key-fk)');
  });
});
