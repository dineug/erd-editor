import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/separator/Separator.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Separator.styles', () => {
  it('exports separator and horizontal as distinct class identifiers', () => {
    const separator = String(styles.separator);
    const horizontal = String(styles.horizontal);

    expect(separator.length).toBeGreaterThan(0);
    expect(horizontal.length).toBeGreaterThan(0);
    expect(separator).not.toBe(horizontal);
  });

  it('paints the line with the gray custom property', () => {
    expect(staticText(styles.separator)).toContain(
      'background-color: var(--gray-color-6)'
    );
  });

  it('makes the horizontal token a full width one pixel rule', () => {
    const text = staticText(styles.horizontal);
    expect(text).toContain('width: 100%');
    expect(text).toContain('height: 1px');
  });
});
