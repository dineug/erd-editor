import { describe, expect, it } from 'vite-plus/test';

import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import * as styles from '@/components/visualization/visualization-toolbar/VisualizationToolbar.styles';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('VisualizationToolbar.styles', () => {
  it('compiles every export to its own class identifier', () => {
    const names = [
      styles.showModeTrigger,
      styles.showModeLabel,
      styles.showModeMenu,
    ].map(String);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/\S/);
  });

  /*
   * The two tabs draw one bar in two places, so the bar itself — where it
   * stands, its chrome, its pill and the rule between its groups — is declared
   * once in the ERD toolbar. What is left here is what only this tab carries.
   */
  it('declares nothing of the bar the ERD toolbar owns (AC-1, AC-2, AC-3)', () => {
    expect(Object.keys(styles)).toEqual([
      'showModeTrigger',
      'showModeLabel',
      'showModeMenu',
    ]);

    const text = staticText(floating.root);
    expect(text).toContain('position: absolute');
    expect(text).toContain('left: 50%');
    expect(text).toContain('bottom: 24px');
    expect(text).toContain('transform: translateX(-50%)');
    expect(text).toContain('flex-direction: row');
    expect(text).toContain('border-radius: 8px');
    expect(text).toContain('border: 1px solid var(--toast-border)');
    expect(text).toContain('background-color: var(--toast-background)');
    expect(text).toContain('box-shadow: 0 1px 6px -3px var(--minimap-shadow)');
  });

  // The row display trigger names its mode between a glyph and a chevron, so
  // it cannot be 26px square. It splices the same pill in rather than
  // declaring a second one, which keeps the widened button part of the bar.
  it('widens that same pill for the row display trigger rather than declaring another (AC-3)', () => {
    const text = staticText(styles.showModeTrigger);

    // The one interpolation, rather than a search of the literal halves for a
    // restated pill: a second copy would arrive as another interpolation,
    // which the literals this reads never carry.
    expect(styles.showModeTrigger.values).toEqual([floating.menu]);
    expect(text).toContain('width: auto');
    expect(staticText(floating.menu)).toContain('width: 26px');
  });

  it('spells the mode out at the width of the longest of the three', () => {
    const text = staticText(styles.showModeLabel);

    expect(styles.showModeLabel.values).toContain(typography.paragraph);
    expect(text).toContain('min-width: 62px');
    expect(text).toContain('white-space: nowrap');
  });

  it('opens the row display menu upwards, anchored to the trigger, over the bar', () => {
    const text = staticText(styles.showModeMenu);

    expect(text).toContain('& > .context-menu-content');
    expect(text).toContain('transform: translate(-50%, -100%)');
    // The bar itself is a positioned z-index: 1 in the same stacking context,
    // so a menu left at auto paints under the pill that opened it.
    expect(text).toContain('z-index: 2');
    expect(staticText(floating.root)).toContain('z-index: 1');
  });
});
