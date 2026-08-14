import { describe, expect, it } from 'vitest';

import * as styles from '@/components/visualization/Visualization.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Visualization.styles', () => {
  it('exports root as the only css template token', () => {
    expect(Object.keys(styles)).toEqual(['root']);
    expect(styles.root).toBeTruthy();
    expect(String(styles.root).length).toBeGreaterThan(0);
  });

  it('fills its parent and scrolls the oversized force graph', () => {
    const text = staticText(styles.root);

    expect(text).toContain('height: 100%');
    expect(text).toContain('overflow: auto');
  });

  it('positions relatively so the hovered table preview can be placed inside', () => {
    expect(staticText(styles.root)).toContain('position: relative');
  });

  it('paints itself from the canvas background custom property', () => {
    expect(staticText(styles.root)).toContain(
      'background-color: var(--canvas-background)'
    );
  });
});
