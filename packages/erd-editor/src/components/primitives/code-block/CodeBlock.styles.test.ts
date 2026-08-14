import { describe, expect, it } from 'vitest';

import * as styles from '@/components/primitives/code-block/CodeBlock.styles';

const source = (tpl: { strings: TemplateStringsArray }) =>
  tpl.strings.raw.join('');

describe('CodeBlock.styles', () => {
  it('exports the three css template literals the component renders with', () => {
    expect(styles.root).toBeTruthy();
    expect(styles.code).toBeTruthy();
    expect(styles.clipboard).toBeTruthy();
  });

  it('resolves every export to a distinct non-empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.code),
      String(styles.clipboard),
    ];

    identifiers.forEach(identifier => {
      expect(typeof identifier).toBe('string');
      expect(identifier.length).toBeGreaterThan(0);
    });
    expect(new Set(identifiers).size).toBe(3);
  });

  it('positions the clipboard button and drives it from the foreground/active tokens', () => {
    const clipboard = source(styles.clipboard);

    expect(clipboard).toContain('position: absolute');
    expect(clipboard).toContain('top: 0');
    expect(clipboard).toContain('right: 0');
    expect(clipboard).toContain('cursor: pointer');
    expect(clipboard).toContain('opacity: 0');
    expect(clipboard).toContain('var(--foreground)');
    expect(clipboard).toContain('var(--active)');
  });

  it('reveals the clipboard button from the root hover rule', () => {
    expect(source(styles.root)).toContain('&:hover');
    expect(source(styles.root)).toContain('opacity: 1');
    expect(styles.root.values).toContain(styles.clipboard);
  });

  it('makes the root a relative, overflow-hidden box', () => {
    const root = source(styles.root);

    expect(root).toContain('position: relative');
    expect(root).toContain('overflow: hidden');
    expect(root).toContain('min-height: 40px');
  });

  it('keeps the code area scrollable and on the code font token', () => {
    const code = source(styles.code);

    expect(code).toContain('white-space: pre');
    expect(code).toContain('overflow: auto');
    expect(code).toContain('var(--code-font-family)');
    expect(code).toContain('color: var(--active)');
    expect(code).toContain('padding: 16px');
  });
});
