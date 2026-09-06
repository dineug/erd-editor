import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/floating-toolbar/FloatingToolbar.styles';

describe('FloatingToolbar.styles', () => {
  it('compiles every export to its own class identifier', () => {
    const names = [styles.root, styles.menu, styles.divider].map(String);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/\S/);
  });

  it('stands over the top left corner of the canvas, in a column', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('left: 20px');
    expect(source).toContain('top: 20px');
    expect(source).toContain('flex-direction: column');
  });

  it('marks the tool in use with the active colour a menu uses everywhere', () => {
    const source = styles.menu.strings.join('');

    expect(source).toContain('cursor: pointer');
    expect(source).toContain('&.active');
    expect(source).toContain('color: var(--active)');
  });
});
