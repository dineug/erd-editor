import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/find-replace/FindReplace.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

const tokens = [
  styles.root,
  styles.controls,
  styles.header,
  styles.row,
  styles.actions,
  styles.input,
  styles.toggle,
  styles.scopes,
  styles.scope,
  styles.status,
  styles.count,
  styles.list,
  styles.match,
  styles.icon,
  styles.body,
  styles.text,
  styles.mark,
  styles.location,
  styles.more,
];

describe('FindReplace.styles', () => {
  it('gives every token the panel uses a distinct class', () => {
    const names = tokens.map(String);

    expect(names.every(name => name.length > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it('floats the panel over the left of the canvas, clear of the minimap, above the tab', () => {
    const text = staticText(styles.root);

    expect(text).toContain('position: absolute');
    expect(text).toContain('left: 16px');
    expect(text).not.toContain('right:');
    expect(text).toContain('z-index: 1');
    expect(text).toContain('var(--context-menu-background)');
  });

  it('marks the pressed options and the current match with the theme tokens', () => {
    expect(staticText(styles.toggle)).toContain('&.active');
    expect(staticText(styles.scope)).toContain('var(--accent-color-3)');
    expect(staticText(styles.match)).toContain('var(--column-select)');
    expect(staticText(styles.input)).toContain('var(--focus)');
    expect(staticText(styles.mark)).toContain('var(--accent-color-5)');
  });
});
