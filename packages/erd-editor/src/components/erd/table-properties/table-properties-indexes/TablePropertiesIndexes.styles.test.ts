import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes.styles';
import { COLUMN_HEIGHT, TABLE_PADDING } from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('TablePropertiesIndexes.styles', () => {
  it('exports the two panes and the add button area', () => {
    expect(Object.keys(styles)).toEqual([
      'leftArea',
      'rightArea',
      'addIndexButtonArea',
    ]);

    const identifiers = Object.values(styles).map(String);
    expect(new Set(identifiers).size).toBe(3);
  });

  it('keeps the keys at 260px and gives the columns the rest', () => {
    const left = staticText(styles.leftArea);
    const right = staticText(styles.rightArea);

    expect(left).toContain('flex: 0 1 260px');
    expect(left).toContain('min-width: 220px');
    expect(right).toContain('flex: 1 1 520px');
    expect(right).toContain('min-width: 0');

    for (const text of [left, right]) {
      expect(text).toContain('display: flex');
      expect(text).toContain('flex-direction: column');
      expect(text).not.toMatch(/width: \d+%/);
      expect(text).not.toContain('height: 100%');
      expect(text).not.toContain('padding-right');
    }
  });

  it('sets both panes in the row size of the canvas table', () => {
    expect(styles.leftArea.values).toEqual([typography.paragraph]);
    expect(styles.rightArea.values).toEqual([typography.paragraph]);
  });

  it('makes the add index row a clickable full width line', () => {
    const text = staticText(styles.addIndexButtonArea);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('cursor: pointer');
    expect(text).toContain('&:hover');
    expect(text).toContain('var(--column-hover)');
    expect(text).toContain('var(--active)');
  });

  it('interpolates the shared layout constants into the add button row', () => {
    expect(styles.addIndexButtonArea.values).toContain(COLUMN_HEIGHT);
    expect(styles.addIndexButtonArea.values).toContain(TABLE_PADDING);
  });
});
