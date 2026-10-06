import { describe, expect, it } from 'vite-plus/test';

import * as indexStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-key/IndexesKey.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  COLUMN_UNIQUE_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesKey.styles', () => {
  it('exports the row, tag, name and lock tokens', () => {
    expect(Object.keys(styles)).toEqual(['row', 'tag', 'name', 'lock']);
    expect(new Set(Object.values(styles).map(String)).size).toBe(4);
  });

  it('pushes the lock to the end of the row, in the box an index keeps its remove button in', () => {
    const text = staticText(styles.lock);

    expect(text).toContain('margin-inline-start: auto');
    expect(text).toContain('flex-shrink: 0');
    expect(text).toContain('width: 20px');
    expect(text).toContain('justify-content: center');
    expect(text).toContain('color: var(--placeholder)');
  });

  it('keeps its row a class of its own, apart from an editable index row', () => {
    expect(String(styles.row)).not.toBe(String(indexStyles.row));
  });

  it('draws the row in text to read, pickable, with the index row box', () => {
    const text = staticText(styles.row);

    expect(text).toContain('display: flex');
    expect(text).toContain('color: var(--foreground)');
    expect(text).not.toContain('var(--placeholder)');
    expect(text).toContain('cursor: pointer');
    expect(text).toContain('var(--column-hover)');
    expect(styles.row.values).toContain(COLUMN_HEIGHT);
    expect(styles.row.values).toContain(TABLE_PADDING);
    expect(styles.row.values).toContain(COLUMN_PADDING);
    expect(styles.row.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('marks the picked row with the tint, a bar along its edge and its name in the active colour', () => {
    const text = staticText(styles.row);

    expect(text).toMatch(
      /&\.selected \{\s*color: var\(--active\);\s*background-color: var\(--column-select\);\s*box-shadow: inset 3px 0 0 var\(--accent-color-10\);\s*\}/
    );
    expect(text).toMatch(
      /&\.selected:hover \{\s*background-color: var\(--column-select-hover\);\s*\}/
    );
  });

  it('fills the kind tag, as wide as the UQ toggle of an index row', () => {
    const text = staticText(styles.tag);

    expect(text).toContain('display: inline-flex');
    expect(text).toContain('justify-content: center');
    expect(text).toContain('height: 16px');
    expect(text).toContain('border-radius: 3px');
    expect(text).toContain('background-color: var(--gray-color-5)');
    expect(text).toContain('color: var(--active)');
    expect(text).toContain('font-size: 10px');
    expect(text).toContain('font-weight: var(--font-weight-medium)');
    expect(text).toContain('user-select: none');
    expect(styles.tag.values).toEqual([COLUMN_UNIQUE_WIDTH]);
  });

  it('starts the name where an index name starts and cuts it short on one line', () => {
    const text = staticText(styles.name);

    expect(text).toContain('padding-inline-start: 4px');
    expect(text).toContain('min-width: 0');
    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toContain('white-space: nowrap');
  });
});
