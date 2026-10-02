import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs.styles';
import * as lnbStyles from '@/components/settings/settings-lnb/SettingsLnb.styles';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

/** Each declaration and nested rule of a template, one trimmed line apiece. */
const declarationLines = (literals: { strings: TemplateStringsArray }) =>
  staticText(literals)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

describe('TablePropertiesTabs.styles', () => {
  it('exports the `tabs` and `tab` css templates', () => {
    expect(Object.keys(styles)).toEqual(['tabs', 'tab']);
    expect(Array.isArray(styles.tabs.strings)).toBe(true);
    expect(Array.isArray(styles.tab.strings)).toBe(true);
    expect(String(styles.tabs)).not.toBe(String(styles.tab));
  });

  it('lays the strip out on the header baseline and rules it off from the body', () => {
    const text = staticText(styles.tabs);

    expect(text).toContain('display: flex');
    expect(text).toContain('gap: 4px');
    expect(text).toContain('padding: 8px 12px');
    expect(text).toContain('min-height: 48px');
    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain(
      'border-bottom: 1px solid var(--context-menu-border)'
    );
    expect(text).toContain('overflow-x: auto');
  });

  it('renders each tab as a rounded non-selectable pill', () => {
    const text = staticText(styles.tab);

    expect(text).toContain('align-items: center');
    expect(text).toContain('padding: 0 12px');
    expect(text).toContain('height: 32px');
    expect(text).toContain('border-radius: 4px');
    expect(text).toContain('cursor: default');
    expect(text).toContain('white-space: nowrap');
  });

  it('names its own font size, which the dialog leaves unset', () => {
    expect(styles.tab.values).toEqual([typography.normal]);
  });

  it('carries the hover and selected states the component toggles', () => {
    const text = staticText(styles.tab);

    expect(text).toContain('&:hover');
    expect(text).toContain('&.selected');
    expect(text).toContain('var(--context-menu-select)');
    expect(text).toContain('color: var(--active)');
  });

  /** A menu item's accent hover would outshine the gray-4 tab that is selected. */
  it('hovers a tab on gray-3, under the selected tab rather than over it', () => {
    const text = staticText(styles.tab);

    expect(text).toMatch(
      /&:hover \{\s*background-color: var\(--gray-color-3\);/
    );
    expect(text).not.toContain('var(--context-menu-hover)');
  });

  it('declares everything the Settings list item declares', () => {
    const tab = declarationLines(styles.tab);

    expect(
      declarationLines(lnbStyles.item).filter(line => !tab.includes(line))
    ).toEqual([]);
  });
});
