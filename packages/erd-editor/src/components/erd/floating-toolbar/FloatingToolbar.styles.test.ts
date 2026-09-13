import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import { typography } from '@/styles/typography.styles';

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

  it('marks the tool in use with the active colour a menu uses everywhere', () => {
    const text = staticText(styles.menu);

    expect(text).toContain('cursor: pointer');
    expect(text).toContain('&.active');
    expect(text).toContain('color: var(--active)');
  });

  it('stands its divider on its side, the way a row of tools needs one', () => {
    const text = staticText(styles.divider);

    expect(text).toContain('width: 1px');
    expect(text).toContain('height: 18px');
  });

  it('holds the zoom readout at one width, in tabular figures', () => {
    const text = staticText(styles.readout);

    expect(styles.readout.values).toContain(typography.paragraph);
    expect(text).toContain('min-width: 44px');
    expect(text).toContain('text-align: center');
    expect(text).toContain('font-variant-numeric: tabular-nums');
  });

  /*
   * The compass prints the gap as well as the heading, so it is the one button
   * that cannot be 26px square. It splices the same pill in rather than
   * declaring a second one, which keeps the widened button part of the bar.
   */
  it('widens that same pill for the compass rather than declaring another', () => {
    const text = staticText(styles.compass);

    expect(styles.compass.values).toEqual([styles.menu]);
    expect(text).toContain('width: auto');
    expect(text).toContain('gap: 6px');
    expect(String(styles.compass)).not.toBe(String(styles.menu));
  });

  it('prints that gap in tabular figures', () => {
    const text = staticText(styles.compassDistance);

    expect(styles.compassDistance.values).toContain(typography.paragraph);
    expect(text).toContain('font-variant-numeric: tabular-nums');
  });
});
