import { describe, expect, it } from 'vitest';

import * as styles from '@/components/settings/settings-lnb/SettingsLnb.styles';

const source = (style: { strings: TemplateStringsArray }) =>
  style.strings.join('');

describe('SettingsLnb.styles', () => {
  it('compiles each export to its own class identifier', () => {
    const all = [styles.lnb, styles.list, styles.item];

    for (const style of all) {
      expect(String(style)).toMatch(/^_/);
      expect(String(style)).toBe(String(style));
      expect(style.values).toEqual([]);
    }

    expect(new Set(all.map(String)).size).toBe(all.length);
  });

  it('stacks the lnb as a full height hidden-overflow column', () => {
    const css = source(styles.lnb);

    expect(css).toContain('display: flex');
    expect(css).toContain('flex-direction: column');
    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
    expect(css).toContain('overflow: hidden');
  });

  it('scrolls the list vertically only', () => {
    const css = source(styles.list);

    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('overflow-y: auto');
  });

  it('describes the item hover and selected states consumers toggle', () => {
    const css = source(styles.item);

    expect(css).toContain('padding: 0 12px');
    expect(css).toContain('height: 32px');
    expect(css).toContain('border-radius: 4px');
    expect(css).toContain('cursor: default');
    expect(css).toContain('&:hover');
    expect(css).toContain('background-color: var(--context-menu-hover)');
    expect(css).toContain('&.selected');
    expect(css).toContain('background-color: var(--context-menu-select)');
    expect(css).toContain('color: var(--active)');
    expect(css).toContain('fill: var(--active)');
  });
});
