import { describe, expect, it } from 'vite-plus/test';

import * as indexStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-key/IndexesKey.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesKey.styles', () => {
  it('exports the row, name and lock tokens', () => {
    expect(Object.keys(styles)).toEqual(['row', 'name', 'lock']);
    expect(new Set(Object.values(styles).map(String)).size).toBe(3);
  });

  it('pushes the lock to the end of the row, where an index keeps its remove button', () => {
    const text = staticText(styles.lock);

    expect(text).toContain('margin-left: auto');
    expect(text).toContain('flex-shrink: 0');
  });

  it('keeps its row a class of its own, apart from an editable index row', () => {
    expect(String(styles.row)).not.toBe(String(indexStyles.row));
  });

  it('draws the row muted and with the index row box', () => {
    const text = staticText(styles.row);

    expect(text).toContain('display: flex');
    expect(text).toContain('color: var(--placeholder)');
    expect(text).toContain('cursor: default');
    expect(text).toContain('var(--column-hover)');
    expect(text).toContain('&.selected');
    expect(text).toContain('var(--column-select)');
    expect(styles.row.values).toContain(COLUMN_HEIGHT);
    expect(styles.row.values).toContain(TABLE_PADDING);
    expect(styles.row.values).toContain(COLUMN_PADDING);
    expect(styles.row.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('cuts a long name short on one line', () => {
    const text = staticText(styles.name);

    expect(text).toContain('text-overflow: ellipsis');
    expect(text).toContain('white-space: nowrap');
  });
});
