import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/TableProperties.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('TableProperties.styles', () => {
  it('exports every token the component composes as a css template', () => {
    expect(Object.keys(styles)).toEqual([
      'root',
      'container',
      'scrollbarArea',
      'header',
      'tab',
      'scope',
    ]);

    for (const token of Object.values(styles)) {
      expect(Array.isArray(token.strings)).toBe(true);
      expect(String(token).startsWith('_')).toBe(true);
    }
  });

  it('generates a distinct class identifier per token', () => {
    const identifiers = Object.values(styles).map(String);

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('stretches the root over its positioned parent and dims it', () => {
    const text = staticText(styles.root);

    expect(text).toContain('position: absolute');
    expect(text).toContain('inset: 0');
    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 100%');
    expect(text).toContain('display: flex');
    expect(text).toContain('align-items: center');
    expect(text).toContain('justify-content: center');
    expect(text).toContain('&::after');
    expect(text).toContain('background-color: rgba(0, 0, 0, 0.4)');
  });

  it('builds the dialog container as a bounded scrollable card', () => {
    const text = staticText(styles.container);

    expect(text).toContain('flex-direction: column');
    expect(text).toContain('max-width: 900px');
    expect(text).toContain('max-height: calc(100% - 32px)');
    expect(text).toContain('position: relative');
    expect(text).toContain('z-index: 1');
    expect(text).toContain('overflow: hidden');
    expect(text).toContain('var(--context-menu-background)');
    expect(text).toContain('var(--context-menu-border)');
  });

  it('lets the body area scroll vertically and the header horizontally', () => {
    expect(staticText(styles.scrollbarArea)).toContain('overflow: auto');
    expect(staticText(styles.scrollbarArea)).toContain(
      'padding: 0 12px 12px 12px'
    );
    expect(staticText(styles.header)).toContain('overflow-x: auto');
    expect(staticText(styles.header)).toContain('min-height: 32px');
  });

  it('carries the selected/hover states the table tab toggles', () => {
    const text = staticText(styles.tab);

    expect(text).toContain('&:hover');
    expect(text).toContain('&.selected');
    expect(text).toContain('& > span');
    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toContain('white-space: nowrap');
    expect(text).toContain('var(--context-menu-hover)');
    expect(text).toContain('var(--context-menu-select)');
    expect(text).toContain('var(--active)');
  });

  it('gives the tab panel scope a minimum height', () => {
    const text = staticText(styles.scope);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 100%');
    expect(text).toContain('min-height: 450px');
  });
});
