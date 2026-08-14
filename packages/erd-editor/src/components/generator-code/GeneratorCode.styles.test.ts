import { describe, expect, it } from 'vitest';

import * as styles from '@/components/generator-code/GeneratorCode.styles';

const source = (tpl: { strings: TemplateStringsArray }) =>
  tpl.strings.raw.join('');

describe('GeneratorCode.styles', () => {
  it('exports the single root css template literal the component renders with', () => {
    expect(styles.root).toBeTruthy();
    expect(Object.keys(styles)).toEqual(['root']);
  });

  it('resolves the root export to a non-empty class identifier', () => {
    const identifier = String(styles.root);

    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
  });

  it('makes the root a relative full-size box so the context menu can anchor to it', () => {
    const root = source(styles.root);

    expect(root).toContain('position: relative');
    expect(root).toContain('width: 100%');
    expect(root).toContain('height: 100%');
    expect(root).toContain('overflow: hidden');
  });

  it('paints the root from the canvas background token', () => {
    expect(source(styles.root)).toContain(
      'background-color: var(--canvas-background)'
    );
  });

  it('interpolates no nested css values into the root rule', () => {
    expect(styles.root.values).toEqual([]);
  });
});
