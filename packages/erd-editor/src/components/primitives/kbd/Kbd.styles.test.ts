import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/kbd/Kbd.styles';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Kbd.styles', () => {
  it('exports root, kbd and mini as distinct class identifiers', () => {
    const identifiers = [styles.root, styles.kbd, styles.mini].map(String);

    for (const identifier of identifiers) {
      expect(identifier.length).toBeGreaterThan(0);
    }
    expect(new Set(identifiers).size).toBe(3);
  });

  it('lays the root out as a flex row', () => {
    expect(staticText(styles.root)).toContain('display: flex');
  });

  it('styles the normal chip with the foreground custom property', () => {
    const text = staticText(styles.kbd);
    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('border: 1px solid var(--foreground)');
    expect(text).toContain('margin-right: 4px');
    expect(text).toContain('&:last-child');
    expect(styles.kbd.values).toContain(typography.paragraph);
  });

  it('styles the mini chip with the placeholder custom property', () => {
    const text = staticText(styles.mini);
    expect(text).toContain('color: var(--placeholder)');
    expect(text).toContain('border: 1px solid var(--placeholder)');
    expect(text).toContain('font-size: 10px');
    expect(text).toContain('margin-right: 2px');
  });
});
