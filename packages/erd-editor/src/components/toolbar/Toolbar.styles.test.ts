import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/toolbar/Toolbar.styles';
import { TOOLBAR_HEIGHT } from '@/constants/layout';

describe('Toolbar.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.databaseName),
      String(styles.vertical),
      String(styles.menu),
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

  it('spaces the text inputs through a child selector, on the side a line ends', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('& > input');
    expect(source).toContain('margin-inline-end: 15px');
    expect(source).not.toContain('margin-right');
  });

  it("spaces a readonly editor's database name as the field, cutting a long one short", () => {
    const source = styles.databaseName.strings.join('');

    expect(source).toContain('font: -moz-field');
    expect(source).toContain('font: -webkit-small-control');
    expect(source).toContain('font-family: var(--text-font-family)');
    expect(source.indexOf('font: -moz-field')).toBeLessThan(
      source.indexOf('font: -webkit-small-control')
    );
    expect(source).toContain('flex-shrink: 0');
    expect(source).toContain('margin-inline-end: 15px');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain('text-overflow: ellipsis');
    expect(source).toContain('color: var(--active)');
    expect(source).toContain('&[data-empty]');
    expect(source).toContain('color: var(--placeholder)');
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

  it('highlights active and hovered menu items with the active color', () => {
    const source = styles.menu.strings.join('');

    expect(source).toContain('&.active');
    expect(source).toContain('&:hover');
    expect(source).toContain('color: var(--active)');
  });

  it('disables the undo-redo group until it carries the active class', () => {
    const source = styles.menu.strings.join('');

    expect(source).toContain('&.undo-redo');
    expect(source).toContain('cursor: not-allowed');
    expect(source).toContain('color: var(--foreground)');
    expect(source).toContain('&.undo-redo.active');
  });

  it('dims a disabled menu item as Find and Replace dims its own, hovered or not', () => {
    const source = styles.menu.strings.join('');
    const disabled = source.slice(source.indexOf('&.disabled'));

    expect(source.indexOf('&.disabled')).toBeGreaterThan(
      source.indexOf('&:hover')
    );
    expect(disabled).toContain('cursor: not-allowed');
    expect(disabled).toContain('color: var(--foreground)');
    expect(disabled).toContain('opacity: 0.4');
  });
});
