import { describe, expect, it } from 'vitest';

import * as styles from '@/components/primitives/button/Button.styles';
import { fontSize1, fontSize2, fontSize3 } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('Button.styles', () => {
  it('exports every variant and size token as a css template', () => {
    const names = [
      'button',
      'soft',
      'solid',
      'size1',
      'size2',
      'size3',
    ] as const;

    for (const name of names) {
      const token = styles[name];
      expect(token).toBeTruthy();
      expect(typeof token.toString()).toBe('string');
      expect(token.toString().length).toBeGreaterThan(0);
    }
  });

  it('generates a distinct class identifier per token', () => {
    const identifiers = [
      styles.button,
      styles.soft,
      styles.solid,
      styles.size1,
      styles.size2,
      styles.size3,
    ].map(String);

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('makes the base token an inline-flex clickable box', () => {
    const text = staticText(styles.button);
    expect(text).toContain('display: inline-flex');
    expect(text).toContain('cursor: pointer');
    expect(text).toContain('border-radius: 6px');
  });

  it('drives the soft variant from the accent custom properties', () => {
    const text = staticText(styles.soft);
    expect(text).toContain('--accent-color-3');
    expect(text).toContain('--accent-color-11');
    expect(text).toContain('--accent-color-4');
    expect(text).toContain('--accent-color-5');
  });

  it('drives the solid variant from the accent custom properties', () => {
    const text = staticText(styles.solid);
    expect(text).toContain('--accent-color-9');
    expect(text).toContain('--accent-color-10');
    expect(text).toContain('color: #fff');
  });

  it('gives each size its own height and font-size token', () => {
    expect(staticText(styles.size1)).toContain('height: 24px');
    expect(staticText(styles.size2)).toContain('height: 32px');
    expect(staticText(styles.size3)).toContain('height: 40px');

    expect(styles.size1.values).toContain(fontSize1);
    expect(styles.size2.values).toContain(fontSize2);
    expect(styles.size3.values).toContain(fontSize3);
  });
});
