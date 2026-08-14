import { describe, expect, it } from 'vitest';

import * as styles from '@/components/primitives/context-menu/context-menu-item/ContextMenuItem.styles';

describe('ContextMenuItem.styles', () => {
  it('exports item as a css template literal resolving to a class name', () => {
    expect(Array.isArray(styles.item.strings.raw)).toBe(true);
    expect(String(styles.item)).toMatch(/^[\w-]+$/);
  });

  it('sizes the row and suppresses the text cursor', () => {
    const css = styles.item.strings.raw.join('');

    expect(css).toContain('height: 32px;');
    expect(css).toContain('padding: 0 12px;');
    expect(css).toContain('cursor: default;');
  });

  it('declares hover and selected states backed by custom properties', () => {
    const css = styles.item.strings.raw.join('');

    expect(css).toContain('&:hover');
    expect(css).toContain('background-color: var(--context-menu-hover);');
    expect(css).toContain('color: var(--active);');
    expect(css).toContain('&.selected');
    expect(css).toContain('background-color: var(--context-menu-select);');
  });
});
