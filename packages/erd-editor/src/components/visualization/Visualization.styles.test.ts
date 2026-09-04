import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/visualization/Visualization.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Visualization.styles', () => {
  it('exports the root and the stage box as css template tokens', () => {
    expect(Object.keys(styles)).toEqual(['root', 'stage']);
    expect(String(styles.root).length).toBeGreaterThan(0);
    expect(String(styles.stage).length).toBeGreaterThan(0);
  });

  it('fills its parent and clips rather than scrolls, since the graph pans', () => {
    const text = staticText(styles.root);

    expect(text).toContain('height: 100%');
    expect(text).toContain('overflow: hidden');
    expect(text).not.toContain('overflow: auto');
  });

  it('positions relatively so the hovered table preview can be placed inside', () => {
    expect(staticText(styles.root)).toContain('position: relative');
  });

  it('paints itself from the canvas background custom property', () => {
    expect(staticText(styles.root)).toContain(
      'background-color: var(--canvas-background)'
    );
  });

  it('pins the stage box to the corner of the root', () => {
    const text = staticText(styles.stage);

    expect(text).toContain('position: relative');
    expect(text).toContain('top: 0');
    expect(text).toContain('left: 0');
  });
});
