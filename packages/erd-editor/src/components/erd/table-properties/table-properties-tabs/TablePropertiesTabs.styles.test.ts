import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('TablePropertiesTabs.styles', () => {
  it('exports the `tabs` and `tab` css templates', () => {
    expect(Object.keys(styles)).toEqual(['tabs', 'tab']);
    expect(Array.isArray(styles.tabs.strings)).toBe(true);
    expect(Array.isArray(styles.tab.strings)).toBe(true);
    expect(String(styles.tabs)).not.toBe(String(styles.tab));
  });

  it('lays the tab strip out as a padded flex row', () => {
    const text = staticText(styles.tabs);

    expect(text).toContain('display: flex');
    expect(text).toContain('padding: 12px');
    expect(text).toContain('min-height: 56px');
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

  it('carries the hover and selected states the component toggles', () => {
    const text = staticText(styles.tab);

    expect(text).toContain('&:hover');
    expect(text).toContain('&.selected');
    expect(text).toContain('var(--context-menu-hover)');
    expect(text).toContain('var(--context-menu-select)');
    expect(text).toContain('color: var(--active)');
    expect(text).toContain('fill: var(--active)');
  });
});
