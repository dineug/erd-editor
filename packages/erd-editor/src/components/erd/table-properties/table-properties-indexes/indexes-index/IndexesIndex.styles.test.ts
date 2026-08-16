import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesIndex.styles', () => {
  it('exports the row, input, unique and iconButton tokens', () => {
    expect(Object.keys(styles)).toEqual([
      'row',
      'input',
      'unique',
      'iconButton',
    ]);

    const identifiers = Object.values(styles).map(String);
    expect(new Set(identifiers).size).toBe(4);
  });

  it('keeps the row transparent until it is hovered', () => {
    const text = staticText(styles.row);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('fill: transparent');
    expect(text).toContain('color: transparent');
    expect(text).toContain('&:hover');
    expect(text).toContain('var(--foreground)');
    expect(text).toContain('var(--column-hover)');
  });

  it('carries the `.selected` state the component toggles', () => {
    const text = staticText(styles.row);

    expect(text).toContain('&.selected');
    expect(text).toContain('var(--column-select)');
    expect(text).toContain('& > .column-col');
  });

  it('interpolates the shared layout constants into the row', () => {
    expect(styles.row.values).toContain(COLUMN_HEIGHT);
    expect(styles.row.values).toContain(TABLE_PADDING);
    expect(styles.row.values).toContain(COLUMN_PADDING);
    expect(styles.row.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('stretches the name input over its cell', () => {
    expect(staticText(styles.input)).toContain('width: 100%');
  });

  it('makes the unique cell and the remove icon clickable', () => {
    expect(staticText(styles.unique)).toContain('cursor: pointer');

    const iconButton = staticText(styles.iconButton);
    expect(iconButton).toContain('cursor: pointer');
    expect(iconButton).toContain('margin-left: auto');
    expect(iconButton).toContain('&:hover');
    expect(iconButton).toContain('fill: var(--active)');
    expect(iconButton).toContain('color: var(--active)');
  });
});
