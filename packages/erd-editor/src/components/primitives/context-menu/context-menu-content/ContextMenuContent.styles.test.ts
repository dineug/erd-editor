import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/context-menu/context-menu-content/ContextMenuContent.styles';

describe('ContextMenuContent.styles', () => {
  it('exports content as a css template literal resolving to a class name', () => {
    expect(Array.isArray(styles.content.strings.raw)).toBe(true);
    expect(String(styles.content)).toMatch(/^[\w-]+$/);
  });

  it('positions the popup with fixed positioning and a column layout', () => {
    const css = styles.content.strings.raw.join('');

    expect(css).toContain('position: fixed;');
    expect(css).toContain('display: flex;');
    expect(css).toContain('flex-direction: column;');
    expect(css).toContain('min-width: max-content;');
  });

  it('wires the surface colors to the context menu custom properties', () => {
    const css = styles.content.strings.raw.join('');

    expect(css).toContain('background-color: var(--context-menu-background);');
    expect(css).toContain('border: 1px solid var(--context-menu-border);');
  });
});
