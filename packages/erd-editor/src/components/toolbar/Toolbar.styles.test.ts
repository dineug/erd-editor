import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/toolbar/Toolbar.styles';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

describe('Toolbar.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.vertical),
      String(styles.menu),
      String(styles.tableCount),
    ];

    for (const identifier of identifiers) {
      expect(identifier).toMatch(/\S/);
    }
    expect(new Set(identifiers).size).toBe(4);
  });

  it('is stable: stringifying the same template twice yields one class', () => {
    expect(String(styles.root)).toBe(String(styles.root));
  });

  it('locks the toolbar bar to the shared toolbar height', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('height: ');
    expect(source).toContain('min-height: ');
    expect(styles.root.values).toEqual([TOOLBAR_HEIGHT, TOOLBAR_HEIGHT]);
  });

  it('lays the bar out as a single non wrapping row', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('display: flex');
    expect(source).toContain('align-items: center');
    expect(source).toContain('white-space: nowrap');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain('padding: 0 15px');
    expect(source).toContain('background-color: var(--toolbar-background)');
  });

  it('spaces the text inputs through a child selector', () => {
    expect(styles.root.strings.join('')).toContain('& > input');
  });

  it('renders the vertical rule as a fixed width spacer', () => {
    const source = styles.vertical.strings.join('');

    expect(source).toContain('width: 10px');
    expect(source).toContain('height: 100%');
    expect(styles.vertical.values).toEqual([]);
  });

  it('makes a menu item a clickable full height flex cell', () => {
    const source = styles.menu.strings.join('');

    expect(source).toContain('cursor: pointer');
    expect(source).toContain('display: flex');
    expect(source).toContain('align-items: center');
    expect(source).toContain('height: 100%');
  });

  it('highlights active and hovered menu items with the active fill', () => {
    const source = styles.menu.strings.join('');

    expect(source).toContain('&.active');
    expect(source).toContain('&:hover');
    expect(source).toContain('fill: var(--active)');
  });

  it('disables the undo-redo group until it carries the active class', () => {
    const source = styles.menu.strings.join('');

    expect(source).toContain('&.undo-redo');
    expect(source).toContain('cursor: not-allowed');
    expect(source).toContain('fill: var(--foreground)');
    expect(source).toContain('&.undo-redo.active');
  });

  it('pushes the table count to the end of the bar with paragraph type', () => {
    const source = styles.tableCount.strings.join('');

    expect(source).toContain('margin-left: auto');
    expect(source).toContain('align-self: center');
    expect(source).toContain('white-space: nowrap');
    expect(styles.tableCount.values).toEqual([typography.paragraph]);
  });
});
