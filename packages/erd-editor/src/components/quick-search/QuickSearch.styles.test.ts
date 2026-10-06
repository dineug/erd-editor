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
      styles.field,
      styles.search,
      styles.scope,
      styles.hint,
      styles.hintItem,
      styles.empty,
      styles.prefix,
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
      styles.field,
      styles.search,
      styles.scope,
      styles.hint,
      styles.hintItem,
      styles.empty,
      styles.prefix,
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

  it('gives the input the row and the scope label only the room it needs after it', () => {
    expect(staticText(styles.field)).toContain('display: flex');
    expect(staticText(styles.search)).toContain('flex: 1');
    expect(staticText(styles.search)).toContain('min-width: 0');

    const scope = staticText(styles.scope);
    expect(scope).toContain('flex-shrink: 0');
    expect(scope).toContain('margin-inline-end: 16px');
    expect(scope).not.toContain('margin-right');
    expect(scope).toContain('color: var(--accent-color-11)');
    expect(scope).toContain('background-color: var(--accent-color-3)');
    expect(styles.scope.values).toContain(typography.paragraph);
  });

  it('dims the prefix hint like the keyword column, lighting the one pointed at', () => {
    expect(staticText(styles.hint)).toContain('flex-wrap: wrap');

    const item = staticText(styles.hintItem);
    expect(item).toContain('color: var(--placeholder)');
    expect(item).toContain('cursor: pointer');
    expect(item).toContain('&:hover');
    expect(item).toContain('color: var(--active)');
    expect(styles.hintItem.values).toContain(typography.paragraph);
  });

  it('dims the line saying no command matches like the hint, above the list', () => {
    const text = staticText(styles.empty);

    expect(text).toContain('padding: 0 16px 12px');
    expect(text).toContain('color: var(--placeholder)');
    expect(styles.empty.values).toContain(typography.paragraph);
  });

  it('draws a prefix character as a key in the code font', () => {
    const text = staticText(styles.prefix);

    expect(text).toContain('border: 1px solid var(--context-menu-border)');
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('font-family: var(--code-font-family)');
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

  it('reserves a fixed gutter after the row icon, on its left under a right-to-left language', () => {
    const text = staticText(styles.icon);

    expect(text).toContain('min-width: 14px');
    expect(text).toContain('margin-inline-end: 8px');
    expect(text).not.toContain('margin-right');
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

  it('pushes the shortcut to the far end of the row, its left under a right-to-left language', () => {
    const text = staticText(styles.shortcut);

    expect(text).toContain('margin-inline-start: auto');
    expect(text).toContain('padding-inline-start: 24px');
    expect(text).not.toMatch(/(margin|padding)-left/);
    expect(text).toContain('align-items: center');
  });
});
