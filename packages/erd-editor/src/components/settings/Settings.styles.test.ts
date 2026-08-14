import { describe, expect, it } from 'vitest';

import * as styles from '@/components/settings/Settings.styles';

const source = (style: { strings: TemplateStringsArray }) =>
  style.strings.join('');

describe('Settings.styles', () => {
  it('compiles every exported template to a stable class identifier', () => {
    const staticStyles = [
      styles.root,
      styles.lnbArea,
      styles.contentArea,
      styles.content,
      styles.section,
      styles.row,
      styles.columnOrderSection,
      styles.columnOrderList,
      styles.columnOrderItem,
    ];

    for (const style of staticStyles) {
      expect(String(style)).toMatch(/^_/);
      expect(String(style)).toBe(String(style));
    }

    const identifiers = new Set(staticStyles.map(String));
    expect(identifiers.size).toBe(staticStyles.length);
  });

  it('lays the panel out as a padded flex row over the context menu background', () => {
    const css = source(styles.root);

    expect(css).toContain('display: flex');
    expect(css).toContain('position: relative');
    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('padding: 32px');
    expect(css).toContain('background-color: var(--context-menu-background)');
  });

  it('declares the flip move class the FlipAnimation toggles', () => {
    const css = source(styles.root);

    expect(css).toContain('.column-order-move');
    expect(css).toContain('transition: transform 0.3s');
  });

  it('gives the lnb a fixed 200px column and the content the remaining space', () => {
    expect(source(styles.lnbArea)).toContain('width: 200px');
    expect(source(styles.contentArea)).toContain('flex-direction: column');
    expect(source(styles.contentArea)).toContain('padding-left: 16px');
  });

  it('lets the content area wrap and scroll', () => {
    const css = source(styles.content);

    expect(css).toContain('overflow: auto');
    expect(css).toContain('flex-flow: wrap');
  });

  it('spaces sections and rows', () => {
    expect(source(styles.section)).toContain('margin: 0 32px 32px 0');
    expect(source(styles.section)).toContain('min-width: 300px');

    const row = source(styles.row);
    expect(row).toContain('white-space: nowrap');
    expect(row).toContain('height: 24px');
    expect(row).toContain('align-items: center');
    expect(row).toContain('margin-bottom: 16px');
  });

  describe('vertical', () => {
    it('interpolates the given size as the spacer width', () => {
      const spacer = styles.vertical(16);

      expect(spacer.values).toEqual([16]);
      expect(source(spacer)).toContain('width: ');
      expect(source(spacer)).toContain('px;');
      expect(source(spacer)).toContain('height: 100%');
    });

    it('produces a class identifier per distinct size', () => {
      expect(String(styles.vertical(8))).toMatch(/^_/);
      expect(String(styles.vertical(8))).toBe(String(styles.vertical(8)));
      expect(String(styles.vertical(8))).not.toBe(String(styles.vertical(16)));
    });
  });

  it('describes the draggable column order rows and their state classes', () => {
    expect(source(styles.columnOrderSection)).toContain(
      'flex-direction: column'
    );
    expect(source(styles.columnOrderList)).toContain('flex-direction: column');

    const item = source(styles.columnOrderItem);
    expect(item).toContain('cursor: move');
    expect(item).toContain('height: 32px');
    expect(item).toContain('border-radius: 4px');
    expect(item).toContain('&:hover');
    expect(item).toContain('background-color: var(--context-menu-hover)');
    expect(item).toContain('&.none-hover');
    expect(item).toContain('background-color: transparent');
    expect(item).toContain('&.dragging');
    expect(item).toContain('opacity: 0.5');
  });
});
