import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/view-controls/viewControls.styles';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('viewControls.styles', () => {
  it('compiles every export to its own class identifier', () => {
    const names = [
      styles.menu,
      styles.readout,
      styles.divider,
      styles.compass,
      styles.compassDistance,
    ].map(String);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/\S/);
  });

  it('marks the tool in use with the active colour a menu uses everywhere', () => {
    const text = staticText(styles.menu);

    expect(text).toContain('cursor: pointer');
    expect(text).toContain('&.active');
    expect(text).toContain('color: var(--active)');
  });

  /** The accent a menu item hovers on would outshine the gray-4 tool in use. */
  it('hovers a tool on gray-3, under the tool in use rather than over it', () => {
    const text = staticText(styles.menu);

    expect(text).toMatch(
      /&:hover \{\s*color: var\(--active\);\s*background-color: var\(--gray-color-3\);/
    );
    expect(text).toMatch(
      /&\.active \{\s*color: var\(--active\);\s*background-color: var\(--context-menu-select\);/
    );
    expect(text).not.toContain('var(--context-menu-hover)');
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

  /** It is the reset button too, so it hovers the way the tools beside it do. */
  it('widens that same pill for the zoom readout rather than declaring another', () => {
    const text = staticText(styles.readout);

    expect(styles.readout.values).toEqual([styles.menu, typography.paragraph]);
    expect(text).toContain('width: auto');
    expect(String(styles.readout)).not.toBe(String(styles.menu));
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
