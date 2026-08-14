import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesCheckboxColumn.styles', () => {
  it('exports a single `root` css template literal', () => {
    expect(Object.keys(styles)).toEqual(['root']);
    expect(Array.isArray(styles.root.strings)).toBe(true);
    expect(String(styles.root).startsWith('_')).toBe(true);
  });

  it('stacks the checkbox rows in a bounded scroll area', () => {
    const text = staticText(styles.root);

    expect(text).toContain('display: flex');
    expect(text).toContain('flex-direction: column');
    expect(text).toContain('width: 100%');
    expect(text).toContain('max-height: 240px');
    expect(text).toContain('overflow: auto');
  });

  it('interpolates nothing — it is a fully static rule', () => {
    expect(styles.root.values).toEqual([]);
  });
});
