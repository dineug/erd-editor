import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/TableProperties.styles';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('TableProperties.styles', () => {
  it('exports every token the component composes as a css template', () => {
    expect(Object.keys(styles)).toEqual([
      'root',
      'container',
      'header',
      'title',
      'readonlyBadge',
      'tables',
      'tableChip',
      'close',
      'scrollbarArea',
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
    expect(text).toContain('justify-content: center');
    expect(text).toContain('&::after');
    expect(text).toContain('background-color: rgba(0, 0, 0, 0.4)');
  });

  it('hangs the dialog from the palette line, 60px under the editor top', () => {
    const text = staticText(styles.root);

    expect(text).toContain('align-items: flex-start');
    expect(text).not.toContain('align-items: center');
    expect(text).toMatch(/padding:\s+px 16px 16px/);
    expect(styles.root.values).toEqual([60 - TOOLBAR_HEIGHT]);
  });

  it('gives all three tabs one fixed box the host can only shorten', () => {
    const text = staticText(styles.container);

    expect(text).toContain('flex-direction: column');
    expect(text).toContain('max-width: 1040px');
    expect(text).toContain('height: 600px');
    expect(text).toContain('max-height: 100%');
    expect(text).not.toContain('calc(100% - 32px)');
    expect(text).toContain('position: relative');
    expect(text).toContain('z-index: 1');
    expect(text).toContain('overflow: hidden');
    expect(text).toContain('var(--context-menu-background)');
    expect(text).toContain('var(--context-menu-border)');
  });

  it('sets no font size on the container or the body, which the code tabs keep their own', () => {
    for (const token of [styles.container, styles.scrollbarArea]) {
      expect(staticText(token)).not.toContain('font-size');
      expect(token.values).not.toContain(typography.normal);
      expect(token.values).not.toContain(typography.paragraph);
    }
  });

  it('rules the header off at 48px with the title, the chips and the close button in a row', () => {
    const header = staticText(styles.header);

    expect(header).toContain('display: flex');
    expect(header).toContain('align-items: center');
    expect(header).toContain('gap: 12px');
    expect(header).toContain('height: 48px');
    expect(header).toContain('flex-shrink: 0');
    expect(header).toContain('padding: 0 12px');
    expect(header).toContain(
      'border-bottom: 1px solid var(--context-menu-border)'
    );

    const title = staticText(styles.title);
    expect(title).toContain('color: var(--active)');
    expect(title).toContain('white-space: nowrap');
    expect(title).toContain('flex-shrink: 0');

    const tables = staticText(styles.tables);
    expect(tables).toContain('flex: 1 1 0');
    expect(tables).toContain('min-width: 0');
    expect(tables).toContain('gap: 4px');
    expect(tables).toContain('overflow-x: auto');
  });

  it('draws the read only badge as a quiet bordered label that never shrinks', () => {
    const text = staticText(styles.readonlyBadge);

    expect(text).toContain('display: inline-flex');
    expect(text).toContain('align-items: center');
    expect(text).toContain('gap: 4px');
    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('height: 20px');
    expect(text).toContain('padding: 0 6px');
    expect(text).toContain('border: 1px solid var(--context-menu-border)');
    expect(text).toContain('border-radius: 3px');
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('white-space: nowrap');
    expect(styles.readonlyBadge.values).toEqual([typography.paragraph]);
  });

  it('draws a table as the chip Find and Replace draws a scope', () => {
    const text = staticText(styles.tableChip);

    expect(text).toContain('display: inline-flex');
    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('max-width: 160px');
    expect(text).toContain('height: 22px');
    expect(text).toContain('padding: 0 8px');
    expect(text).toContain('border: 1px solid var(--context-menu-border)');
    expect(text).toContain('border-radius: 9999px');
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('cursor: pointer');
    expect(text).toMatch(/&:hover \{\s*color: var\(--active\);\s*\}/);
    expect(text).toMatch(
      /&\.selected \{\s*color: var\(--accent-color-11\);\s*border-color: var\(--accent-color-8\);\s*background-color: var\(--accent-color-3\);\s*\}/
    );
    expect(text).toContain('& > span');
    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toContain('white-space: nowrap');
  });

  it('draws the close button as the 26px tool Find and Replace closes with', () => {
    const text = staticText(styles.close);

    expect(text).toContain('width: 26px');
    expect(text).toContain('height: 26px');
    expect(text).toContain('border-radius: 4px');
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('cursor: pointer');
    expect(text).toMatch(
      /&:hover \{\s*color: var\(--active\);\s*background-color: var\(--context-menu-hover\);\s*\}/
    );
  });

  it('rings the close button in the input colour only when the keyboard reached it', () => {
    const text = staticText(styles.close);

    expect(text).toMatch(
      /&:focus-visible \{\s*outline: 2px solid var\(--input-active\);\s*outline-offset: 1px;\s*\}/
    );
    expect(text).not.toContain('var(--focus)');
  });

  it('lets the body take what the header and tabs leave and scroll on its own', () => {
    const text = staticText(styles.scrollbarArea);

    expect(text).toContain('flex-direction: column');
    expect(text).toContain('flex: 1 1 auto');
    expect(text).toContain('min-height: 0');
    expect(text).toContain('padding: 12px;');
    expect(text).toContain('overflow: auto');
  });

  it('wraps the Indexes panes and leaves the height to the body', () => {
    const text = staticText(styles.scope);

    expect(text).toContain('display: flex');
    expect(text).toContain('flex-wrap: wrap');
    expect(text).toContain('align-items: flex-start');
    expect(text).toContain('gap: 12px');
    expect(text).toContain('width: 100%');
    expect(text).toContain('flex-shrink: 0');
    expect(text).not.toContain('min-height: 450px');
    expect(text).not.toContain('height: 100%');
  });

  it('fills the body with a bordered well on a code tab', () => {
    const text = staticText(styles.scope);

    expect(text).toMatch(
      /&\.code \{\s*flex: 1 1 auto;\s*min-height: 0;\s*flex-wrap: nowrap;\s*border: 1px solid var\(--context-menu-border\);\s*border-radius: 4px;\s*overflow: hidden;\s*\}/
    );
  });
});
