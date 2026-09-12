import { describe, expect, it } from 'vite-plus/test';

import * as floating from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import * as styles from '@/components/visualization/visualization-toolbar/VisualizationToolbar.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('VisualizationToolbar.styles', () => {
  it('compiles every export to its own class identifier', () => {
    const names = [styles.root, styles.divider, styles.readout].map(String);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/\S/);
  });

  it('stands over the middle of the bottom edge, in a row (AC-1)', () => {
    const text = staticText(styles.root);

    expect(text).toContain('position: absolute');
    expect(text).toContain('left: 50%');
    expect(text).toContain('bottom: 24px');
    expect(text).toContain('transform: translateX(-50%)');
    expect(text).toContain('flex-direction: row');
  });

  it('wears the chrome the ERD floating toolbar wears (AC-2)', () => {
    const text = staticText(styles.root);

    expect(text).toContain('border-radius: 8px');
    expect(text).toContain('border: 1px solid var(--toast-border)');
    expect(text).toContain('background-color: var(--toast-background)');
    expect(text).toContain('box-shadow: 0 1px 6px -3px var(--minimap-shadow)');
  });

  it('takes the pill button from that toolbar rather than declaring one (AC-3)', () => {
    const text = staticText(floating.menu);

    expect(text).toContain('width: 26px');
    expect(text).toContain('height: 26px');
    expect(text).toContain('background-color: var(--context-menu-hover)');
    expect(text).toContain('background-color: var(--context-menu-select)');
    expect(Object.keys(styles)).toEqual(['root', 'divider', 'readout']);
  });

  it('stands its divider on its side, where the column toolbar lays one flat', () => {
    const text = staticText(styles.divider);

    expect(text).toContain('width: 1px');
    expect(text).toContain('height: 18px');
    expect(staticText(floating.divider)).toContain('height: 1px');
  });

  it('holds the zoom readout at one width with tabular figures', () => {
    const text = staticText(styles.readout);

    expect(text).toContain('min-width: 44px');
    expect(text).toContain('font-variant-numeric: tabular-nums');
    expect(text).toContain('text-align: center');
  });

  // The ERD toolbar's own placement is a spec of that module (left 20px, top
  // 20px, a column). Nothing here may carry it, or the two bars would fight
  // for the same corner.
  it('carries none of the ERD toolbar root placement', () => {
    const text = staticText(styles.root);

    expect(String(styles.root)).not.toBe(String(floating.root));
    expect(text).not.toContain('left: 20px');
    expect(text).not.toContain('top: 20px');
    expect(text).not.toContain('flex-direction: column');
  });
});
