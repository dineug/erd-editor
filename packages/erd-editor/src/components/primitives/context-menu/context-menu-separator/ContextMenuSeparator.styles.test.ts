import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/context-menu/context-menu-separator/ContextMenuSeparator.styles';

const source = (style: { strings: TemplateStringsArray }) =>
  style.strings.raw.join('');

describe('ContextMenuSeparator.styles', () => {
  it('exports separator as a css template literal resolving to a class name', () => {
    expect(Array.isArray(styles.separator.strings.raw)).toBe(true);
    expect(String(styles.separator)).toMatch(/^[\w-]+$/);
  });

  it('draws a one pixel rule in the menu border token, 4px clear above and below', () => {
    const css = source(styles.separator);

    expect(css).toContain('height: 0;');
    expect(css).toContain('margin: 4px 0;');
    expect(css).toContain('border-top: 1px solid var(--context-menu-border);');
  });

  it('paints no background, which forced colors repaint in the menu color', () => {
    expect(source(styles.separator)).not.toContain('background');
  });
});
