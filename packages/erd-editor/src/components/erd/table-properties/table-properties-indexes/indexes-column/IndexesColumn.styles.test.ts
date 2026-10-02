import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn.styles';
import {
  COLUMN_HEIGHT,
  COLUMN_PADDING,
  INDEX_ORDER_MAX_ROWS,
  INPUT_MARGIN_RIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { typography } from '@/styles/typography.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('IndexesColumn.styles', () => {
  it('exports the root, row, grip, orderType and mark tokens', () => {
    expect(Object.keys(styles)).toEqual([
      'root',
      'row',
      'grip',
      'orderType',
      'mark',
    ]);

    const identifiers = Object.values(styles).map(String);
    expect(new Set(identifiers).size).toBe(5);
  });

  it('declares the flip animation class the component adds while moving', () => {
    const text = staticText(styles.root);

    expect(text).toContain('.index-column-order-move');
    expect(text).toContain('transition: transform 0.3s');
  });

  it('shows three rows under its label and scrolls the rest', () => {
    const text = staticText(styles.root);

    expect(text).not.toContain('padding-top');
    expect(text).toMatch(/max-height:\s+px;/);
    expect(styles.root.values).toEqual([COLUMN_HEIGHT * INDEX_ORDER_MAX_ROWS]);
    expect(INDEX_ORDER_MAX_ROWS).toBe(3);
    expect(text).toContain('overflow-y: auto');
  });

  it('sets a row in the size of the canvas table rows', () => {
    expect(styles.row.values).toContain(typography.paragraph);
  });

  it('quiets the drag handle', () => {
    expect(staticText(styles.grip)).toContain('color: var(--placeholder)');
  });

  it('puts the alternate key mark at the end of the row in the accent text colour', () => {
    const text = staticText(styles.mark);

    expect(text).toContain('margin-left: auto');
    expect(text).toContain('color: var(--accent-color-11)');
    expect(text).toContain('font-variant-numeric: tabular-nums');
    expect(text).toContain('white-space: nowrap');
  });

  it('renders each index column as a draggable full width line', () => {
    const text = staticText(styles.row);

    expect(text).toContain('display: flex');
    expect(text).toContain('width: 100%');
    expect(text).toContain('align-items: center');
    expect(text).toContain('cursor: move');
    expect(text).toContain('color: var(--active)');
  });

  it('carries the drag states the dragstart handler toggles', () => {
    const text = staticText(styles.row);

    expect(text).toContain('&:hover');
    expect(text).toContain('var(--column-hover)');
    expect(text).toContain('&.none-hover');
    expect(text).toContain('background-color: transparent');
    expect(text).toContain('&.dragging');
    expect(text).toContain('opacity: 0.5');
    expect(text).toContain('& > .column-col');
  });

  it('interpolates the shared layout constants into the row', () => {
    expect(styles.row.values).toContain(COLUMN_HEIGHT);
    expect(styles.row.values).toContain(TABLE_PADDING);
    expect(styles.row.values).toContain(COLUMN_PADDING);
    expect(styles.row.values).toContain(INPUT_MARGIN_RIGHT);
  });

  it('gives a read only row a plain cursor', () => {
    expect(staticText(styles.row)).toMatch(
      /&\[data-readonly\] \{\s*cursor: default;\s*\}/
    );
  });

  it('makes the order type cell clickable', () => {
    expect(staticText(styles.orderType)).toContain('cursor: pointer');
  });
});
