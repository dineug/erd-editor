import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/theme-builder/ThemeBuilder.styles';
import { fontSize5, typography } from '@/styles/typography.styles';

describe('ThemeBuilder.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.title),
      String(styles.subTitle),
      String(styles.palette),
      String(styles.color),
      String(styles.lightDarkButtonGroup),
      String(styles.lightDarkButton),
      String(styles.vertical),
    ];

    for (const identifier of identifiers) {
      expect(identifier).toMatch(/\S/);
    }
    expect(new Set(identifiers).size).toBe(8);
  });

  it('is stable: stringifying the same template twice yields one class', () => {
    expect(String(styles.root)).toBe(String(styles.root));
    expect(String(styles.color)).toBe(String(styles.color));
  });

  it('pins the panel below the toolbar as a bordered context menu surface', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('top: 46px');
    expect(source).toContain('left: 16px');
    expect(source).toContain('padding: 24px');
    expect(source).toContain('width: 360px');
    expect(source).toContain('border-radius: 6px');
    expect(source).toContain(
      'background-color: var(--context-menu-background)'
    );
    expect(source).toContain('border: 1px solid var(--context-menu-border)');
    expect(styles.root.values).toEqual([]);
  });

  it('renders the heading with the active color and the level 5 font size', () => {
    const source = styles.title.strings.join('');

    expect(source).toContain('color: var(--active)');
    expect(source).toContain('margin-bottom: 24px');
    expect(styles.title.values).toEqual([fontSize5]);
  });

  it('renders section subtitles with normal typography and top spacing', () => {
    const source = styles.subTitle.strings.join('');

    expect(source).toContain('margin-top: 24px');
    expect(source).toContain('color: var(--active)');
    expect(styles.subTitle.values).toEqual([typography.normal]);
  });

  it('lays the swatch palette out as a ten column grid', () => {
    const source = styles.palette.strings.join('');

    expect(source).toContain('display: grid');
    expect(source).toContain(
      'grid-template-columns: repeat(10, minmax(0, 1fr))'
    );
    expect(source).toContain('gap: 8px');
    expect(source).toContain('margin-top: 12px');
    expect(styles.palette.values).toEqual([]);
  });

  it('draws a swatch as a clickable circle that outlines when selected', () => {
    const source = styles.color.strings.join('');

    expect(source).toContain('border-radius: 9999px');
    expect(source).toContain('width: 24px');
    expect(source).toContain('height: 24px');
    expect(source).toContain('cursor: pointer');
    expect(source).toContain('border: 1px solid transparent');
    expect(source).toContain('&.selected');
    expect(source).toContain('outline: solid 2px var(--gray-color-12)');
    expect(styles.color.values).toEqual([]);
  });

  it('lays the appearance buttons out as a two column grid', () => {
    const source = styles.lightDarkButtonGroup.strings.join('');

    expect(source).toContain('display: grid');
    expect(source).toContain(
      'grid-template-columns: repeat(2, minmax(0, 1fr))'
    );
    expect(source).toContain('gap: 8px');
    expect(styles.lightDarkButtonGroup.values).toEqual([]);
  });

  it('styles an appearance button with hover fill and a selected border', () => {
    const source = styles.lightDarkButton.strings.join('');

    expect(source).toContain('display: flex');
    expect(source).toContain('align-items: center');
    expect(source).toContain('justify-content: center');
    expect(source).toContain('cursor: pointer');
    expect(source).toContain('height: 32px');
    expect(source).toContain('border: 1px solid var(--context-menu-border)');
    expect(source).toContain('&:hover');
    expect(source).toContain('background-color: var(--column-hover)');
    expect(source).toContain('&.selected');
    expect(source).toContain('border-color: var(--gray-color-12)');
    expect(styles.lightDarkButton.values).toEqual([typography.paragraph]);
  });

  it('renders the icon-to-label spacer as a fixed width full height gap', () => {
    const source = styles.vertical.strings.join('');

    expect(source).toContain('width: 4px');
    expect(source).toContain('height: 100%');
    expect(styles.vertical.values).toEqual([]);
  });
});
