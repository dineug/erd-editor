import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/quick-search/QuickSearch.styles';
import { fontSize3, typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('QuickSearch.styles', () => {
  it('exports every token consumed by QuickSearch as a css template', () => {
    const tokens = [
      styles.root,
      styles.container,
      styles.search,
      styles.list,
      styles.action,
      styles.icon,
      styles.name,
      styles.keyword,
      styles.vertical,
      styles.shortcut,
    ];

    for (const token of tokens) {
      expect(token).toBeTruthy();
      expect(typeof token.toString()).toBe('string');
      expect(token.toString().length).toBeGreaterThan(0);
    }
  });

  it('gives every token a distinct generated class name', () => {
    const names = [
      styles.root,
      styles.container,
      styles.search,
      styles.list,
      styles.action,
      styles.icon,
      styles.name,
      styles.keyword,
      styles.vertical,
      styles.shortcut,
    ].map(String);

    expect(new Set(names).size).toBe(names.length);
  });

  it('stretches the root over the whole editor on the top-most layer', () => {
    const text = staticText(styles.root);

    expect(text).toContain('position: absolute');
    expect(text).toContain('inset: 0');
    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 100%');
    expect(text).toContain('z-index: 2147483647');
  });

  it('drops the palette in from the top and dims the canvas behind it', () => {
    const text = staticText(styles.root);

    expect(text).toContain('align-items: start');
    expect(text).toContain('justify-content: center');
    expect(text).toContain('padding: 60px 16px 16px');
    expect(text).toContain('&::after');
    expect(text).toContain('background-color: rgba(0, 0, 0, 0.4)');
  });

  it('caps the container width and paints it with the context-menu tokens', () => {
    const text = staticText(styles.container);

    expect(text).toContain('flex-direction: column');
    expect(text).toContain('max-width: 600px');
    expect(text).toContain('position: relative');
    expect(text).toContain('z-index: 1');
    expect(text).toContain('background-color: var(--context-menu-background)');
    expect(text).toContain('border: 1px solid var(--context-menu-border)');
    expect(text).toContain('overflow: hidden');
  });

  it('fixes the search input height and inherits the fontSize3 scale', () => {
    const text = staticText(styles.search);

    expect(text).toContain('height: 50px');
    expect(text).toContain('min-height: 50px');
    expect(text).toContain('padding: 12px 16px');
    expect(styles.search.values).toContain(fontSize3);
  });

  it('scrolls the result list once it passes 400px', () => {
    const text = staticText(styles.list);

    expect(text).toContain('max-height: 400px');
    expect(text).toContain('overflow: auto');
    expect(text).toContain('flex-direction: column');
  });

  it('gives each row a fixed height plus hover and selected backgrounds', () => {
    const text = staticText(styles.action);

    expect(text).toContain('min-height: 45px');
    expect(text).toContain('height: 45px');
    expect(text).toContain('cursor: pointer');
    expect(text).toContain('white-space: nowrap');
    expect(text).toContain('&:hover');
    expect(text).toContain('background-color: var(--column-hover)');
    expect(text).toContain('&.selected');
    expect(text).toContain('background-color: var(--column-select)');
  });

  it('reserves a fixed gutter for the row icon', () => {
    const text = staticText(styles.icon);

    expect(text).toContain('min-width: 14px');
    expect(text).toContain('margin-right: 8px');
    expect(text).toContain('align-items: center');
  });

  it('ellipsizes the name with the normal typography scale', () => {
    const text = staticText(styles.name);

    expect(text).toContain('overflow: hidden');
    expect(text).toContain('text-overflow: ellipsis');
    expect(styles.name.values).toContain(typography.normal);
  });

  it('dims the keyword column with the placeholder color', () => {
    const text = staticText(styles.keyword);

    expect(text).toContain('color: var(--placeholder)');
    expect(text).toContain('text-overflow: ellipsis');
    expect(styles.keyword.values).toContain(typography.paragraph);
  });

  it('uses an 8px spacer between the name and the keyword', () => {
    const text = staticText(styles.vertical);

    expect(text).toContain('width: 8px');
    expect(text).toContain('height: 100%');
  });

  it('pushes the shortcut to the far right of the row', () => {
    const text = staticText(styles.shortcut);

    expect(text).toContain('margin-left: auto');
    expect(text).toContain('padding-left: 24px');
    expect(text).toContain('align-items: center');
  });
});
