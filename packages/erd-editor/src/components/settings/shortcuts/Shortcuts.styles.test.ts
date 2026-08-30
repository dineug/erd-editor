import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/settings/shortcuts/Shortcuts.styles';

const source = (style: { strings: TemplateStringsArray }) =>
  style.strings.join('');

describe('Shortcuts.styles', () => {
  it('compiles both exports to distinct class identifiers', () => {
    expect(String(styles.table)).toMatch(/^_/);
    expect(String(styles.shortcutGroup)).toMatch(/^_/);
    expect(String(styles.table)).toBe(String(styles.table));
    expect(String(styles.table)).not.toBe(String(styles.shortcutGroup));
  });

  it('renders the keybinding table as a collapsed full width grid', () => {
    const css = source(styles.table);

    expect(css).toContain('width: 100%');
    expect(css).toContain('text-align: left');
    expect(css).toContain('vertical-align: top');
    expect(css).toContain('border-collapse: collapse');
    expect(css).toContain(
      'border-radius: calc(var(--table-border-radius) - 1px)'
    );
    expect(css).toContain('border-spacing: 0');
  });

  it('interpolates the shared cell rules into both th and td', () => {
    const css = source(styles.table);

    expect(css).toContain('th {');
    expect(css).toContain('td {');
    expect(css).toContain('font-weight: var(--font-weight-bold)');

    // cell is private, but it is interpolated once per cell selector.
    expect(styles.table.values).toHaveLength(2);
    const [th, td] = styles.table.values;
    expect(th).toBe(td);
    expect(source(th)).toContain('padding: 12px');
    expect(source(th)).toContain('height: 44px');
    expect(source(th)).toContain(
      'box-shadow: inset 0 -1px var(--gray-color-5)'
    );
  });

  it('spaces stacked shortcut groups except the last one', () => {
    const css = source(styles.shortcutGroup);

    expect(css).toContain('margin-bottom: 12px');
    expect(css).toContain('&:last-child');
    expect(css).toContain('margin-bottom: 0');
  });
});
