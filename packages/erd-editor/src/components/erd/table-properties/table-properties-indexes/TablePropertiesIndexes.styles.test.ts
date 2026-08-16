import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes.styles';
import { COLUMN_HEIGHT, TABLE_PADDING } from '@/constants/layout';

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

  it('splits the pane widths 30/70 with their own minimums', () => {
    const left = staticText(styles.leftArea);
    const right = staticText(styles.rightArea);

    expect(left).toContain('width: 30%');
    expect(left).toContain('min-width: 240px');
    expect(left).toContain('padding-right: 12px');
    expect(right).toContain('width: 70%');
    expect(right).toContain('min-width: 560px');
    expect(left).toContain('height: 100%');
    expect(right).toContain('height: 100%');
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
