import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/context-menu/menu/Menu.styles';

const source = (style: { strings: TemplateStringsArray }) =>
  style.strings.raw.join('');

describe('Menu.styles', () => {
  it('exports menu, icon and right as css template literals', () => {
    for (const style of [styles.menu, styles.icon, styles.right]) {
      expect(style).toBeTruthy();
      expect(Array.isArray(style.strings.raw)).toBe(true);
    }
  });

  it('resolves every export to a distinct generated class identifier', () => {
    const names = [styles.menu, styles.icon, styles.right].map(String);

    for (const name of names) {
      expect(name).toMatch(/^[\w-]+$/);
      expect(name.length).toBeGreaterThan(0);
    }
    expect(new Set(names).size).toBe(3);
  });

  it('lays the menu row out as a full width flex row', () => {
    const css = source(styles.menu);

    expect(css).toContain('display: flex;');
    expect(css).toContain('align-items: center;');
    expect(css).toContain('width: 100%;');
  });

  it('reserves a fixed gutter for the icon slot', () => {
    const css = source(styles.icon);

    expect(css).toContain('min-width: 14px;');
    expect(css).toContain('margin-right: 8px;');
  });

  it('pushes the right slot to the end of the row', () => {
    const css = source(styles.right);

    expect(css).toContain('margin-left: auto;');
    expect(css).toContain('padding-left: 24px;');
  });
});
