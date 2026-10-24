import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import * as controls from '@/components/erd/view-controls/viewControls.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('FloatingToolbar.styles', () => {
  it('compiles every export to its own class identifier', () => {
    const names = [
      styles.root,
      styles.menu,
      styles.readout,
      styles.divider,
      styles.compass,
      styles.compassDistance,
    ].map(String);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/\S/);
  });

  it('stands over the middle of the bottom edge of the canvas, in a row', () => {
    const text = staticText(styles.root);

    expect(text).toContain('position: absolute');
    expect(text).toContain('left: 50%');
    expect(text).toContain('transform: translateX(-50%)');
    expect(text).toContain('flex-direction: row');
    expect(text).not.toContain('flex-direction: column');
  });

  /** Clear of the scrollbar track that runs along the bottom edge under it. */
  it('holds itself off that edge', () => {
    const text = staticText(styles.root);
    const bottom = Number(/bottom: (\d+)px/.exec(text)?.[1]);

    expect(bottom).toBeGreaterThan(8);
  });

  /** One declaration each, so the bars and the controls in them never part. */
  it("draws the bar's tools in the view controls' own pill, divider, readout and compass", () => {
    expect(styles.menu).toBe(controls.menu);
    expect(styles.divider).toBe(controls.divider);
    expect(styles.readout).toBe(controls.readout);
    expect(styles.compass).toBe(controls.compass);
    expect(styles.compassDistance).toBe(controls.compassDistance);
  });
});
